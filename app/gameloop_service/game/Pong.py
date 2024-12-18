import threading, time, asyncio
from .GameSystem import *
from .utils import tournament_string
from asgiref.sync import async_to_sync
import redis
import json
import requests

# Constants
PLAYER_MOVE_SPEED = 20
GAME_WINNING_SCORE = 2
BALL_MOVE_SPEED = 20
CANVAS_WIDTH = 1280
CANVAS_HEIGHT = 780
VECTOR_CENTER = Vector(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.5)
redis = redis.Redis(host='redis', port=6379, db=0)


class Ball(Entity):
	def __init__(self, x=CANVAS_WIDTH // 2, y=CANVAS_HEIGHT // 2):
		super().__init__(x, y)
		self.add_component(Mesh, Circle(40))
		self.physics = Physics(0, 0, False, False)
		self.add_component(Physics, self.physics)
		self.last_hit = None
		self.second_last_hit = None

	def move(self, x_add, y_add):
		new_pos = self.position.add(Vector(x_add, y_add))
		self.position = new_pos

	def on_collision(self, other, collision_point=None):
		if isinstance(other, Player):
			self.second_last_hit = self.last_hit if self.last_hit != other else self.second_last_hit
			self.last_hit = other
		if collision_point is None:
			return
		ba = self.position.sub(collision_point)
		ba.normalize()
		tangent = Plane(collision_point, ba)
		velocity_normalized = self.physics.velocity.dup().normalize()
		dot_product = tangent.dir.dot(velocity_normalized)
		reflection = velocity_normalized.dup().sub(ba.scale(2 * dot_product))
		reflection.scale(self.physics.velocity.length())
		self.physics.set_velocity_v(reflection)

	def move(self, x_add, y_add):
		new_pos = Vector(self.position.x + x_add, self.position.y + y_add)
		if self.position.x != new_pos.x or self.position.y != new_pos.y:
			self.position = new_pos
			asyncio.run_coroutine_threadsafe(thread_local.pong_game.send_entity_move(self), thread_local.event_loop)
		
class Player(Entity):
	def __init__(self, x, y, height=250):
		super().__init__(x, y)
		self.height = height
		self.mesh = Box(25, self.height)
		self.physics = Physics(0, 0, True, False)
		self.add_component(Mesh, self.mesh)
		self.add_component(Physics, self.physics)
		self.score = 0
		self.start_pos: Vector = None
		self.goal_height = 0

	def move(self, x_add, y_add):
		new_pos = self.position.add(Vector(x_add, y_add))

		# Check if the new player position is still in range of its goal
		if self.start_pos is not None:
			ab = new_pos.sub(self.start_pos)
			len = ab.length()
			if (len == 0):
				len = 0.00001
			ab.scale((len + self.mesh.height * 0.5) / len)
			if len > self.goal_height * 0.5 - self.mesh.height * 0.5:
				return

		if self.position.x != new_pos.x or self.position.y != new_pos.y:
			self.position = new_pos
			#send new position to everyone
			asyncio.run_coroutine_threadsafe(thread_local.pong_game.send_entity_move(self), thread_local.event_loop)
			
	def increase_score(self):
		self.score += 1
		asyncio.run_coroutine_threadsafe(thread_local.host.channel_layer.group_send(
			thread_local.host.group_name,
			{
				'type': 'player_score',
				'id': self.id,
				'score': self.score
			}
		), thread_local.event_loop)

	def handle_remote_movement(self, input):
		if input == 1:
			self.physics.velocity = self.up.dup().scale(PLAYER_MOVE_SPEED)
		elif input == 2:
			self.physics.velocity = self.up.dup().scale(-PLAYER_MOVE_SPEED)
		elif input == 0:
			self.physics.set_velocity(0, 0)

	def on_collision(self, other, collision_point=None):
		ophys = other.get_component(Physics)
		if ophys and collision_point and isinstance(other, Ball):
			drall = collision_point.sub(self.position)
			prev_scale = ophys.velocity.length()
			drall.normalize()
			drall.scale(10)
			ophys.velocity = ophys.velocity.add(drall)
			ophys.velocity.normalize()
			ophys.velocity.scale(prev_scale)

class Wall(Entity):
	def __init__(self, x, y, rot, height):
		super().__init__(x, y)
		self.height = height
		self.mesh = Box(10, height)
		self.rotate(rot)
		self.add_component(Mesh, self.mesh)

class PlayerSection:
	def __init__(self, x, y, rotation, height, ratio = 0.33):
		self.goal = Wall(x, y, rotation, height)
		self.player = Player(x, y, height * ratio)
		self.bind_player()

	def bind_player(self):
		self.player.position = self.goal.position
		self.player.rotate(self.goal.rotation)
		if self.player.up.dot(Vector(0, -1)) < 0:
			self.player.rotate(self.player.rotation + 180)

		forward = VECTOR_CENTER.sub(self.player.position)
		forward.normalize()
		forward.scale(75)
		forward = forward.add(self.player.position)
		self.player.position = forward
		self.player.start_pos = forward
		self.player.goal_height = self.goal.height

class GameLogicManager(Entity):
	def __init__(self):
		super().__init__(0, 0)
		self.sections = []
		self.ball = Ball()
		self.round_running = False
		self.winner = None
		self.counter = time.time()
		self.starter: Player = None
	
	def buildDynamicField(self, world: World, playerCount):
		if playerCount == 2:
			self.sections.append(PlayerSection(0, CANVAS_HEIGHT * .5, 0, CANVAS_HEIGHT))
			self.sections.append(PlayerSection(CANVAS_WIDTH, CANVAS_HEIGHT * .5, 0, CANVAS_HEIGHT))
			world.addEntity(Wall(CANVAS_WIDTH * .5, 0, 90, CANVAS_WIDTH))
			world.addEntity(Wall(CANVAS_WIDTH * .5, CANVAS_HEIGHT, 90, CANVAS_WIDTH))
		elif playerCount == 4:
			self.sections.append(PlayerSection(CANVAS_WIDTH * 0.5 - CANVAS_HEIGHT * 0.5, CANVAS_HEIGHT * 0.5, 0, CANVAS_HEIGHT, 0.22))
			self.sections.append(PlayerSection(CANVAS_WIDTH * 0.5, 0, 90, CANVAS_HEIGHT, 0.22))
			self.sections.append(PlayerSection(CANVAS_WIDTH * 0.5 + CANVAS_HEIGHT * 0.5, CANVAS_HEIGHT * 0.5, 180, CANVAS_HEIGHT, 0.22))
			self.sections.append(PlayerSection(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT, 270, CANVAS_HEIGHT, 0.22))
		else:
			point1 = Vector(0, -CANVAS_HEIGHT / 2)
			rotationStep = 360 / playerCount
			rot = rotationStep * 0.5
			point2 = point1.dup().rotate(rotationStep)
			for _ in range(playerCount):
				ba = point2.sub(point1).scale(0.5)
				midpoint = ba.add(point1).add(VECTOR_CENTER)
				self.sections.append(PlayerSection(midpoint.x, midpoint.y, rot + 90, ba.length() * 2))
				point1.rotate(rotationStep)
				point2.rotate(rotationStep)
				rot += rotationStep
		world.addEntity(self.ball)
		for section in self.sections:
			section.goal.on_collision = self.create_goal_function(section)
			world.addEntity(section.player)
			world.addEntity(section.goal)

		self.starter = self.sections[0].player

	def create_goal_function(self, section):
		def goal_function(other, collision_point=None):
			if isinstance(other, Ball):
				if other.last_hit is not None:
					if other.last_hit != section.player:
						other.last_hit.increase_score()
						self.starter = other.last_hit
					elif other.second_last_hit is not None:
						other.second_last_hit.increase_score()
						self.starter = other.second_last_hit
					thread_local.pong_game.update_tournament_gamestate()
					self.reset_ball()
				else:
					print("WHAT NOW? THIS IS AN INVALID GOAL AS THE BALL WAS LAUNCHED FROM CENTER")
		return goal_function

	def reset_ball(self):
		self.ball.physics.set_velocity(0,0)
		self.ball.set_pos(CANVAS_WIDTH // 2, CANVAS_HEIGHT // 2)

		thread_local.pong_game.send_entity_set_pos(self.ball)
		
		self.winner = self.player_has_won()
		if self.winner is not None:
			thread_local.pong_game.game_complete()
			return
		asyncio.run_coroutine_threadsafe(thread_local.host.channel_layer.group_send(
			thread_local.host.group_name,
			{
				'type': 'round_start',
			}
		), thread_local.event_loop)
		self.round_running = False
		self.counter = time.time()

	def player_has_won(self):
		for section in self.sections:
			if section.player.score >= GAME_WINNING_SCORE:
				lead = True
				for sec in self.sections:
					if sec != section:
						if abs(section.player.score - sec.player.score) < 2:
							lead = False
							break
				if lead:
					return section.player
		return None
	
	def update(self):
		if self.winner is not None:
			return
		if not self.round_running:
			if time.time() - self.counter >= 3.0:
				if self.starter:
					# rework this so it works with player in any orientation
					dir = VECTOR_CENTER.sub(self.starter.start_pos)
					dir.normalize()
					dir.scale(BALL_MOVE_SPEED)
					self.ball.physics.set_velocity_v(dir)
				else:
					self.ball.physics.set_velocity(15, 0)
				self.ball.last_hit = self.starter
				self.round_running = True
			elif self.starter:
				forward = VECTOR_CENTER.sub(self.starter.start_pos)
				forward.normalize()
				forward.scale(50)
				forward = forward.add(self.starter.position)
				if self.ball.position.x != forward.x or self.ball.position.y != forward.y:
					self.ball.set_pos(forward.x, forward.y)
					asyncio.run_coroutine_threadsafe(thread_local.pong_game.send_entity_move(self.ball), thread_local.event_loop)
		if self.ball.physics.velocity.sqr_length() < pow(30, 2):
			self.ball.physics.velocity.scale(1.0002)
		#this check is to reset the round when the ball somehow escapes the play area
		if self.ball.position.sub(VECTOR_CENTER).sqr_length() > (CANVAS_WIDTH*1.5)**2:
			self.reset_ball()


async def getCurrentState(world, consumer):
	for ent in world.entities:
		print('Sending ent id:', ent.id)
		await consumer.client_create_entity(
			{
				'id': ent.id,
				'entType': type(ent).__name__,
				'transform': ent.serialize(),
				'height': 0 if not hasattr(ent, 'height') else ent.height
			}
		)
	await consumer.client_create_entity(
		{
			'id': -1,
			'entType': 'complete',
			'transform': Transform(0, 0, 0).serialize(),
			'heigth': 0
		}
	)

thread_local = threading.local()

#all the stuff for one pong game
class PongGame:
	def __init__(self, playerCount):
		self.playerCount = playerCount
		self.stop_thread = False
		self.world = World()
		self.world.addSystem(CollisionSystem())
		self.world.addSystem(MovementSystem())
		self.gameLogic = GameLogicManager()
		self.players = None
		print(f'Got Players: {self.players}')

		self.world.addEntity(self.gameLogic)
		self.event_loop = None
		self.asyncio_thread = None
		self.game_thread = None

	def set_players(self, group_name):
		self.players = GamesHandler.game_players(group_name)

	def start_game(self):

		print('Starting threads and game!')

		self.gameLogic.buildDynamicField(self.world, self.playerCount)

		self.event_loop = asyncio.new_event_loop()
		self.asyncio_thread = threading.Thread(target=self.asyncio_tasks_thread)
		self.asyncio_thread.start()

		self.game_thread = threading.Thread(target=self.game_loop)
		self.game_thread.start()

		for i, player in enumerate(self.players):
			asyncio.run_coroutine_threadsafe(player.assign_player(self.gameLogic.sections[i].player), self.event_loop)
			asyncio.run_coroutine_threadsafe(getCurrentState(self.world, player), self.event_loop)


	def stop(self):
		self.stop_thread = True
		print(f'stop_thread set to {self.stop_thread}')

	def update_tournament_gamestate(self):
		if self.players[0].match_type == 'tournament':
			data = {}
			data['lobby_id'] = self.players[0].lobby_id
			data['type'] = 'tournament'
			data['match_id'] = self.players[0].match_id
			data['home_score'] = self.players[0].player_c.score
			data['away_score'] = self.players[1].player_c.score
			data['status'] = 'running'
			requests.post('http://gamehub-service:8003/match/', json=data)

	def game_complete(self):
		asyncio.run_coroutine_threadsafe(thread_local.host.channel_layer.group_send(
				thread_local.host.group_name,
				{
					'type': 'game_over',
				}
			), self.event_loop)
		print('We have a winner! Stop game thread, and asyncio thread')
		self.stop()
		data = {}
		data['lobby_id'] = self.players[0].lobby_id
		if self.players[0].match_type == 'match':
			print('Start of DB save')
			data['type'] = 'match'
			data['home_username'] = self.players[0].user.username
			data['away_username'] = self.players[1].user.username
			data['home_score'] = self.players[0].player_c.score
			data['away_score'] = self.players[1].player_c.score
			print('Data successfully saved into DB!')
		elif self.players[0].match_type == 'tournament':
			data['type'] = 'tournament'
			data['match_id'] = self.players[0].match_id
			data['home_score'] = self.players[0].player_c.score
			data['away_score'] = self.players[1].player_c.score
			data['status'] = 'finished'
		elif self.players[0].match_type == 'multiple':
			consumer = next(filter(lambda f: f.player_c == self.gameLogic.winner, self.players), None)
			data['type'] = 'multiple'
			if consumer is not None:
				data['winner_username'] = consumer.user.username
		requests.post('http://gamehub-service:8003/match/', json=data)

	def game_loop(self):
		thread_local.pong_game = self
		thread_local.asyncio_thread = self.asyncio_thread
		thread_local.game_thread = self.game_thread
		thread_local.event_loop = self.event_loop
		thread_local.host = self.players[0]
		thread_local.world = self.world
		iter = 0
		while not self.stop_thread:
			self.world.update()
			time.sleep(0.016)
			if iter == 1000:
				print('game running on', self.players[0].group_name)
				iter = 0
			iter += 1
		print('game loop stopped of group', self.players[0].group_name if len(self.players) != 0 else '[Removed]')
		self.event_loop.call_soon_threadsafe(self.event_loop.stop)
		print('asyncio event_loop ordered to stop')
		for player in self.players:
			(async_to_sync)(player.close)()

	def asyncio_tasks_thread(self):
		asyncio.set_event_loop(self.event_loop)
		self.event_loop.run_forever()
		print('asyncio event_loop stopped')

	"""
	Some big and commonly used sends defined here to make code more readable
	"""
	async def send_entity_move(self, entity):
		for consumer in self.players:
			await consumer.send(text_data=f"up;{entity.id};{entity.position.x};{entity.position.y};{entity.rotation}")
		
	def send_entity_set_pos(self, entity):
		asyncio.run_coroutine_threadsafe(self.players[0].channel_layer.group_send(
			self.players[0].group_name,
			{
				'type': 'set_entity_pos',
				'id': entity.id,
				'transform': entity.serialize()
			}
		), self.event_loop)


class GamesHandler:
	
	game_sessions = {}

	def __init__(self, group_name):
		print('GamesHandler() called')
		self.group_name = group_name
		self.players = []
		self.game = None

	@staticmethod
	async def add_consumer_to_game(consumer, group_name):
		if group_name in GamesHandler.game_sessions:
			print('Group exists in handler, we push the player')
			await GamesHandler.game_sessions[group_name].add_consumer(consumer)
			return
		print('First player of group we create a new GamesHandler')
		new_handler = GamesHandler(group_name=group_name)
		await new_handler.add_consumer(consumer)
		GamesHandler.game_sessions[group_name] = new_handler

	@staticmethod
	async def disconnect_consumer_from_game(consumer, group_name):
		if group_name in GamesHandler.game_sessions:
			print('Group exists in handler, we remove the player')
			await GamesHandler.game_sessions[group_name].remove_consumer(consumer)
			if GamesHandler.game_sessions[group_name].players.__len__() == 0:
				GamesHandler.game_sessions.pop(group_name)
		print('Number of handlers:', len(GamesHandler.game_sessions))

	@staticmethod
	def game_players(group_name):
		if group_name in GamesHandler.game_sessions:
			print(f'Return Players: {GamesHandler.game_sessions[group_name].players}')
			return GamesHandler.game_sessions[group_name].players
		print(f'Return Players: {[]}')
		return []

	async def add_consumer(self, consumer):
		print('GamesHandler.add_consumer() called')
		if self.game and self.players.__len__() < self.game.playerCount or self.players.__len__() < 2:
			if self.players.__len__() == 0:
				if consumer.match_type == 'multiple':
					self.game = PongGame(4)
				else:
					self.game = PongGame(2)
			self.players.append(consumer)
		else:
			print('too many players!!! disconnect consumer')
			await consumer.close()
			return
		if self.players.__len__() == self.game.playerCount:
			print('init PongGame class!')
			if self.players[0].match_type == 'tournament':
				tournament_matches = redis.get(tournament_string(self.players[0].lobby_id))
				if tournament_matches:
					tournament_matches_json = json.loads(tournament_matches)
					match = tournament_matches_json['matches'][self.players[0].match_id - 1]
					if match['home'] == self.players[1].user.id:
						temp = self.players[0]
						self.players[0] = self.players[1]
						self.players[1] = temp
			self.game.set_players(self.group_name)
			self.game.start_game()
	
	async def remove_consumer(self, consumer):
		print('GamesHandler.remove_consumer() called')
		if self.players.__len__() > 0 and consumer in self.players:
			self.players.remove(consumer)
			print(f'\nPlayers after remove in GamesHandler: {self.players}\n')
			print(f'\nPlayers after remove in PonGame: {self.game.players}\n')
		else:
			print('no consumers in this lobby?')
		if self.game is not None and self.players.__len__() < self.game.playerCount:
			print('Stopping Game!')
			self.game.stop()
			for player in self.players:
				if player.channel_layer.valid_channel_name(player.channel_name):
					print('Closing consumer!!')
					try:
						await player.disconnectedMsg({'id': consumer.player_c.id, 'uid': consumer.user.id})
					except Exception as e:
						print(f'Error sending disconnect message: {e}')
				else:
					print('Player already disconnected!')
				await player.close()
			self.players.clear()
