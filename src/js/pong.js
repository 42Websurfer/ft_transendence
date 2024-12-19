import {Vector, Plane, World, Entity, Mesh, Physics, Ray, Box, Circle, RenderSystem, CollisionSystem, MovementSystem, canvas, drawText, strokeText, drawLine, ctx} from './GameSystem.js';
import { showSection } from './index.js';
import { startGame, useCountdownAsMessageDisplay } from './utils.js';

const PLAYER_MOVE_SPEED = 20;
const BALL_MOVE_SPEED = 20;
const VECTOR_CENTER = new Vector(canvas.width * 0.5, canvas.height * 0.5);

export function renderPong(match_id) {

	const app = document.getElementById('app');
	if (app)
	{
		app.style.position = 'relative';
		app.innerHTML = `
		<div class="menu" style="justify-content: center; padding: 2em;">
			<div class="game-container">
				<div id="canvasContainer"></div>
			</div>
			<div class="countdown-container" id="countdownDisplay"></div>
		</div>
		`;

		const canvasContainer = document.getElementById('canvasContainer');

		canvasContainer.appendChild(canvas);
		selectGamemode(match_id);
	}
}

class Ball extends Entity{
	constructor(x = canvas.width / 2, y = canvas.height / 2){
		super(x, y);
		this.addComponent(Mesh, new Circle(40));
		this.physics = new Physics(0,0, false, false);
		this.addComponent(Physics, this.physics);
		this.lastHit = undefined;
		this.secondLastHit = undefined;
	}

	resetBall(){
		this.physics.setVelocity(0, 0);
		this.setPos(canvas.width * 0.5, canvas.height * 0.5);
	}

	static velocityAfterReflection(ballPosition, currentBallVelocity, collisionPoint) {
		let ba = (ballPosition.sub(collisionPoint)).normalize();
		let tangent = new Plane(collisionPoint, ba);
		let velocityNormalized = currentBallVelocity.dup().normalize();
		let dotProduct = tangent.dir.dot(velocityNormalized);
		let reflection = velocityNormalized.sub(ba.scale(2 * dotProduct));
		reflection.scale(currentBallVelocity.length());
		return reflection;
	}

	onCollision(other, collisionPoint = undefined){
		if (other instanceof Player){
			this.secondLastHit = this.lastHit != other ? this.lastHit : this.secondLastHit;
			this.lastHit = other;
		}
		if (collisionPoint === undefined)
			return;
		this.physics.setVelocityV(Ball.velocityAfterReflection(this.position, this.physics.velocity, collisionPoint));
	}
}

class Player extends Entity{
	constructor(x, y, length = 250){
		super(x, y);
		this.height = length;
		this.mesh = new Box(25, length);
		this.physics = new Physics(0, 0, true, false);
		this.addComponent(Mesh, this.mesh);
		this.addComponent(Physics, this.physics);
		this.keyBinds = {up: 'remote', down: 'remote'};
		this.score = 0;
		this.startPos = undefined;
		this.goalHeight = 0;
	}

	move(xAdd, yAdd){
		let newPos = this.position.add(new Vector(xAdd, yAdd));

		// /**
		//  * Check if the new player position is still in range of its goal
		//  * if not dont allow the move
		//  */
		if (this.startPos !== undefined){
			let ab = newPos.sub(this.startPos);
			let len = ab.length();
			ab.scale((len + this.mesh.height * 0.5) / len);
			if (len > (this.goalHeight * 0.5) - this.mesh.height * 0.5)
				return;
		}
		// /**
		//  * Check if the mesh is still inside the canvas
		//  * if not dont allow the move
		//  */
		// let transformedPoints = this.mesh.points.map(p => p.dup().rotate(this.rotation).add(newPos));
		// for (let point of transformedPoints) {
		// 	if (point.x < 0 || point.x > canvas.width)
		// 		return;
		// 	if (point.y < 0 || point.y > canvas.height)
		// 		return;
		// }
		this.position = newPos;
	}

	static playerBallDefleciton(paddlePosition, ballVelocity, collisionPoint) {
		let drall = collisionPoint.sub(paddlePosition);
		let prevScale = ballVelocity.length();
		drall.normalize();
		drall.scale(10);	
		let newVelocity = ballVelocity.add(drall);
		newVelocity.normalize();
		newVelocity.scale(prevScale);
		return newVelocity;
	}

	onCollision(other, collisionPoint = undefined){
		var ophys = other.getComponent(Physics);
		if (ophys && collisionPoint && other instanceof Ball){
			ophys.velocity = Player.playerBallDefleciton(this.position, ophys.velocity, collisionPoint);
		}
	}

	keyDown(event){
		if (event.key === this.keyBinds.up){
			this.physics.velocity = this.up.dup().scale(PLAYER_MOVE_SPEED);
		} else if (event.key === this.keyBinds.down) {
			this.physics.velocity = this.up.dup().scale(-PLAYER_MOVE_SPEED);
		} else {
			return;
		}
		event.preventDefault?.();
	}

	keyUp(event){
		if (event.key === this.keyBinds.up || event.key === this.keyBinds.down){
			this.physics.setVelocity(0, 0);
		} else {
			return;
		}
		event.preventDefault?.();
	}
}

class AiPlayer extends Player {
	constructor(x, y, height, ball, difficulty) {
		super(x, y, height);
		this.gameBall = ball;
		this.difficulty = difficulty;
		this.target = undefined;
		this.brainId = setInterval(() => this.aiBrain(), 1000);
		this.debugPoints = [];
	}

	moveToTarget() {
		if (!this.target) {
			return;
		}
		if (this.target.x > canvas.width * 0.67) {
			if (this.target.y > this.position.y + 10) {
				this.keyDown({ key: this.keyBinds.down });
			} else if (this.target.y < this.position.y - 10) {
				this.keyDown({ key: this.keyBinds.up });
			} else {
				this.keyUp({ key: this.keyBinds.down });
			}
		}
	}

	setTarget(position) {
		this.target = position;
	}

	aiBrain() {
		if (!this.gameBall) {
			//if ball is somehow undefined search for it in the world.entities
			this.gameBall = world.entities.find((value) => value instanceof Ball);
		}

		let position = this.gameBall.position;
		let direction = this.gameBall.physics.velocity.dup();
		this.debugPoints = [position.dup()];
		let ents = world.entities.filter((ent) => !(ent instanceof Ball));
		for (let i = 0; i < this.difficulty; i++) {
			let ray = new Ray(position, direction);
			let hitInfo = ray.castInfo(ents);
			if (!hitInfo) {
				continue;
			}
			if (hitInfo.hitPos.x == NaN || hitInfo.hitPos.y == NaN) {
				continue;
			}
			//hardcoded to simulate that the player will always hit it before the ball hits his goal
			//this is to give AI a way to always somewhat predict a return shot
			//maybe add this?
			if (hitInfo.hitPos.x < 87.5 && hitInfo.entity == manager.sections[0].goal) {
				console.log("Find intersection between ray and and line from x87.5 y0 to x87.5 yMAX then set hitInfo.hitPos to that");
				let angle = Math.atan2(ray.start.y - hitInfo.hitPos.y, ray.start.x - hitInfo.hitPos.x) * (180 / Math.PI);
				console.log('The angle is:', angle, 'angle2:');
				let len = 87.5 / Math.cos(angle);
				console.log('Base:', len, ' scuffed:');
				let yC = ray.start.y + len * Math.sin(angle);
				// ctx.fillRect(87.5, yC, 5, 5);
				console.warn('pos:', 87.5, yC);
				// maybe add this?
				// hitInfo.hitPos.x = 87.5;
				// hitInfo.hitPos.y = yC;
			}
			this.debugPoints.push(hitInfo.hitPos);
			if (hitInfo.entity == manager.sections[1].goal
				|| hitInfo.entity == manager.sections[1].player
				|| hitInfo.entity == manager.sections[0].goal) {
				this.setTarget(hitInfo.hitPos);
				break;
			}
			position = hitInfo.hitPos.add(hitInfo.plane.dir.dup().normalize().rotate(90).scale(20));
			direction = Ball.velocityAfterReflection(position, direction, hitInfo.hitPos);
			if (hitInfo.entity instanceof Player) {
				direction = Player.playerBallDefleciton(hitInfo.entity.position, direction, hitInfo.hitPos);
			}
		}
	}

	update() {
		this.moveToTarget();
		// const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
		// for (let i = 0; i < this.debugPoints.length - 1; i++) {
		// 	drawLine(this.debugPoints[i], this.debugPoints[i + 1], colors[i % colors.length]);
		// }
		// drawLine(new Vector(75 + 25 / 2, 0), new Vector(75 + 25 / 2, canvas.height));
	}
}

class Wall extends Entity{
	constructor(x, y, rot, height){
		super(x, y);
		this.height = height;
		let m = new Box(10, this.height);
		this.rotate(rot);
		this.addComponent(Mesh, m);
	}
}

class PlayerSection extends Entity{
	constructor(x, y, rotation, height, ai = undefined){
		super(x, y);
		this.goal = new Wall(x, y, rotation, height);
		this.player = undefined;
		if (ai) {
			this.player = new AiPlayer(x, y, height * 0.33, undefined, 4);
		} else {
			this.player = new Player(x, y, height * 0.33);
			this.keyDownHandler = (event) => this.player.keyDown(event);
			this.keyUpHandler = (event) => this.player.keyUp(event);
			window.addEventListener('keydown', this.keyDownHandler);
			window.addEventListener('keyup', this.keyUpHandler);
		}
		this.bindPlayer();
		world.addEntity(this.goal);
		world.addEntity(this.player);
	}

	bindPlayer(){
		this.player.setPos(this.goal.position.x, this.goal.position.y);
		this.player.rotate(this.goal.rotation);
		if (this.player.up.dot(new Vector(0, -1)) < 0) // Vector(0, -1) is Global Up
			this.player.rotate(this.player.rotation + 180);
		let forward = VECTOR_CENTER.sub(this.player.position);
		forward.normalize();
		forward.scale(75);
		forward = forward.add(this.player.position);
		this.player.position = forward;
		this.player.startPos = forward;
		this.player.goalHeight = this.goal.height;
	}
}

class PongLocalManager extends Entity{
	constructor(aiOpponent = false){
		super(0, 0);
		this.sections = [];
		this.ball = new Ball();
		this.winner = undefined;
		this.round_running = false;
		this.counter = Date.now();
		this.starter = undefined;
		this.aiOpponent = aiOpponent;
		world.addEntity(this.ball);
		this.initGame();
	}

	buildDynamicField(playerCount){
		if (playerCount === 2){
			this.sections.push(new PlayerSection(0, canvas.height * .5, 0, canvas.height));
			this.sections.push(new PlayerSection(canvas.width, canvas.height * .5, 0, canvas.height, this.aiOpponent));
			this.sections[0].player.keyBinds = {up: 'w', down: 's'};
			this.sections[1].player.keyBinds = {up: 'ArrowUp', down: 'ArrowDown'};
			world.addEntity(new Wall(canvas.width * .5, 0, 90, canvas.width));
			world.addEntity(new Wall(canvas.width * .5, canvas.height, 90, canvas.width));
			return;
		} else if (playerCount == 4) {
			this.sections.push(new PlayerSection(canvas.width * 0.5 - canvas.height * 0.5, canvas.height * 0.5, 0, canvas.height));
			this.sections.push(new PlayerSection(canvas.width * 0.5, 0, 90, canvas.height));
			this.sections.push(new PlayerSection(canvas.width * 0.5 + canvas.height * 0.5, canvas.height * 0.5, 180, canvas.height));
			this.sections.push(new PlayerSection(canvas.width * 0.5, canvas.height, 270, canvas.height));
			this.sections[0].player.keyBinds = {up: 'w', down: 's'};
			this.sections[1].player.keyBinds = {up: 'ArrowUp', down: 'ArrowDown'};
		} else {
			let point1 = new Vector(0, -canvas.height / 2);
			let rotationStep = 360 / playerCount;
			let rot = (rotationStep) / 2;
			let point2 = point1.dup().rotate(rotationStep);
			for (let i = 0; i < playerCount; i++) {
				let ba = point2.sub(point1).scale(0.5);
				let midpoint = ba.add(point1).add(VECTOR_CENTER);
				this.sections.push(new PlayerSection(midpoint.x, midpoint.y, rot + 90, ba.length() * 2));
				point1.rotate(rotationStep);
				point2.rotate(rotationStep);
				rot += rotationStep;
			}
		}
	}

	initGame(){
		
		this.buildDynamicField(2);

		this.sections.forEach( section => {
			this.updatePlayerScore(section.player);
			section.goal.onCollision = (other) =>{
				if (other instanceof Ball){
					if (other.lastHit){
						if (other.lastHit != section.player){
							other.lastHit.score++;
							this.updatePlayerScore(other.lastHit)
						} else if(other.secondLastHit) {
							other.secondLastHit.score++;
							this.updatePlayerScore(other.secondLastHit)
						}
					} else {
						console.log("WHAT THE FUCK DO WE DO NOW?");
					}
					this.resetRound();
				}
			};
		});

		initScoreBoard(['localP1', this.sections[1].player instanceof AiPlayer ? 'AI_King' : 'localP2']);

		this.starter = this.sections[0].player;
	}

	updatePlayerScore(playerScored) {
		this.starter = playerScored;
		let section = this.sections.find((value) => value.player == playerScored);
		let idx = this.sections.indexOf(section);
		console.log('idx:', idx);
		updateScore(idx, playerScored.score);
	}

	resetRound() {
		this.ball.resetBall();
		
		this.winner = this.playerHasWon();
		if (this.winner) {
			console.log('we have a winner', this.winner);
			let displayMsg = document.getElementById('countdownDisplay');
			if (displayMsg) {
				let section = this.sections.find((value) => value.player == this.winner);
				let idx = this.sections.indexOf(section);
				displayMsg.innerText = `localP${idx+1} won!\nPress space to restart!`;
				displayMsg.style.display = 'block';
			}

			const restartGame = (event) => {
				if (event.key == ' ') {
					console.log("RESTART LOCAL GAME!");
					this.winner = undefined;
					for (let section of this.sections) {
						section.player.score = 0;
						this.updatePlayerScore(section.player);
					}
					displayMsg.style.display = 'none';
					window.removeEventListener('keydown', restartGame);
					this.round_running = false;
					this.counter = Date.now();
					startGame();
				}
			}

			window.addEventListener('keydown', restartGame)
			return ;
		}
		this.round_running = false;
		this.counter = Date.now();
		startGame();
	}

	playerHasWon() {
		for (let section of this.sections) {
			if (section.player.score >= 7) {
				let lead = true;
				for (let osection of this.sections) {
					if (osection != section) {
						if (Math.abs(section.player.score - osection.player.score) < 2) {
							lead = false;
							break;
						}
					}
				}
				if (lead) {
					return section.player;
				}
			}
		}
		return undefined;
	}
	
	update() {
		if (this.winner) {
			return;
		}
		if (!this.round_running) {
			if (Date.now() - this.counter >= 3000.0) {
				let dir = VECTOR_CENTER.sub(this.starter.startPos);
				dir.normalize();
				dir.scale(BALL_MOVE_SPEED);
				this.ball.physics.setVelocityV(dir)
				this.ball.lastHit = this.starter;
				this.round_running = true;
				if (this.sections[1].player instanceof AiPlayer) {
					clearInterval(this.sections[1].player.brainId);
					this.sections[1].player.aiBrain();
					this.sections[1].player.brainId = setInterval(() => this.sections[1].player.aiBrain(), 1000);
				}
			} else if (this.starter) {
				let forward = VECTOR_CENTER.sub(this.starter.startPos);
				forward.normalize();
				forward.scale(50);
				forward = forward.add(this.starter.position);
				this.ball.setPos(forward.x, forward.y)
			}
		}
		if (this.ball.physics.velocity.sqrLength() < Math.pow(30, 2))
			this.ball.physics.velocity.scale(1.0002);
		if (this.ball.position.sub(VECTOR_CENTER).sqrLength() > (Math.pow(canvas.width * 1.5, 2))) {
			this.resetRound();
		}
	}

	cleanup(){
		this.sections.forEach(section => {
			if (section.keyDownHandler) {
				window.removeEventListener('keydown', section.keyDownHandler);
			}
			if (section.keyUpHandler) {
				window.removeEventListener('keyup', section.keyUpHandler);
			}
		});
	}
}

//!!!STRAY FUNCTION!!!
function lerp(start, end, t) {
	return start * (1 - t) + end * t;
}

class RemoteHandler extends Entity{
	constructor(){
		super(0, 0);
		this.entities = {};
		this.players = {};
		this.complete = false;
		window.addEventListener('keydown', sendMovementInput);
		window.addEventListener('keyup', sendMovementInput);
	}

	newEntity(type, id, transform, height=undefined){
		let ent = undefined;
		if (type === 'Player'){
			ent = new Player(0, 0, Number(height));
		} else if (type === 'Ball'){
			ent = new Ball(0,0);
		} else if (type === 'Wall'){
			ent = new Wall(0, 0, 0, Number(height));
		} else if (type === 'complete'){
			this.complete = true;
			return;
		} else {
			ent = new Entity(0, 0);
		}
		ent.id = id;
		this.addEntity(ent.id, ent);
		this.setEntityPosition(ent.id, transform);
	}

	addPlayer(entid, uid, uname, sender_uid) {
		this.players[entid] = {uid, uname};
		if (uid === sender_uid) {
			this.entities[entid].mesh.colour = '#ff6666'; //colour is bad
			this.localPlayer = this.players[entid];
		}
		if (Object.keys(this.players).length >= 2) {
			const names = Object.values(this.players).map(player => player.uname);
			initScoreBoard(names, this.localPlayer);
		}
	}

	addEntity(id, ent){
		this.entities[id] = ent;
		world.addEntity(ent);
	}

	setEntityPosition(id, transform){
		const ent = this.entities[id];

		ent.position.x = Number(transform.position.x);
		ent.position.y = Number(transform.position.y);
		ent.rotate(Number(transform.rotation));
	}

	moveEntity(id, transform){
		const ent = this.entities[id];

		ent.position.x = lerp(ent.position.x, transform.position.x, .8);
		ent.position.y = lerp(ent.position.y, transform.position.y, .8);
		ent.rotate(transform.rotation);
	}

	updatePlayerScore(id, score) {
		this.entities[id].score = score;
		let i = 0;
		for (const entid in this.players) {
			updateScore(i, this.entities[entid].score);
			i++;
		}
	}

	removeEntity(id){
		world.removeEntity(this.entities[id]);
		delete this.entities[id];
	}

	cleanup(){
		window.removeEventListener('keypress', sendMovementInput);
		window.removeEventListener('keyup', sendMovementInput);
	}
}

let world = new World();
ctx.fillStyle = '#d8d3d3';

let intervalId;

let manager = undefined;
let socket = undefined;


function sendMovementInput(event) {
	if (event.type == 'keydown') {
		if (event.key == 'w' || event.key == 'ArrowUp') {
			socket.send(0b01);
		} else if (event.key == 's' || event.key == 'ArrowDown') {
			socket.send(0b10);
		}
	} else if (event.type == 'keyup' && (event.key == 's' || event.key == 'w' || event.key == 'ArrowUp' || event.key == 'ArrowDown')) {
		socket.send(0b00);
	} 
}

let lobbyId;
let matchType;

function selectGamemode(groupName){
	let split = groupName?.split('_');
	matchType = split?.length > 0 ? split[0] : undefined;
	lobbyId = split?.length > 1 ? split[1] : undefined;
	if (!matchType || matchType === 'local'){
		world.addSystem(new CollisionSystem());
		world.addSystem(new MovementSystem());
		manager = new PongLocalManager(lobbyId == 'ai');
		setupCloseLocal();
	} else {
		const token = localStorage.getItem('access_token');
		socket = new WebSocket(`wss://${window.location.host}/ws/game/pong/${groupName}/?token=${token}`);
		setupCloseWebsocket(socket);
		manager = new RemoteHandler();
		setupSocketHandlers(socket);
	}
	world.addSystem(new RenderSystem());
	world.addEntity(manager);
	intervalId = setInterval(function() {
		world.update();
	}, 16);
}

function setupSocketHandlers(socket){

	socket.onopen = () => {
		console.log("Connection to remote Pong serverer");
	}
	
	socket.onmessage = (event) => {
		const data = event.data.split(';');

		//newEntity		ne;id;type;xpos;ypos;rotation;?.height
		//updatePos		up;id;xpos;ypos;rot
		//setPos 		sp;id;xpos;ypos;rot
		//roundStart 	rs
		//setScore 		ss;id;score
		//initPlayer 	ip;entid;uid;uname;sender_uid
		//disconnect 	dc;id
		//gameOver 		go
		//drawDot 		dd;x;y
		//drawLine 		dl;x1;y1;x2;y2

		if (data[0] !== 'up')
			console.log(data);
		if (data[0] === 'ne'){
			manager.newEntity(data[2], data[1], {position: {x: data[3], y: data[4]}, rotation: data[5]}, data[6]);
			return;
		}
		if (manager && !manager.complete) {
			socket.send(JSON.stringify({type: 'incomplete'}));
			console.warn('did not recieve all entities. Send request for resend!!!');
			return;
		} 
		if (data[0] === 'up'){
			manager.moveEntity(data[1], {position: {x: data[2], y: data[3]}, rotation: data[4]});
		} else if (data[0] === 'sp'){
			manager.setEntityPosition(data[1], {position: {x: data[2], y: data[3]}, rotation: data[4]});
		} else if (data[0] === 'rs'){
			startGame();
		} else if (data[0] === 'ss'){
			manager.updatePlayerScore(data[1], data[2])
		} else if (data[0] === 'ip') {
			manager.addPlayer(data[1], data[2], data[3], data[4]);
		} else if (data[0] === 'dc') {
			let player = manager.players[data[1]];
			useCountdownAsMessageDisplay(`${player.uname} disconnected!`);
			endGame();
		} else if (data[0] === 'go') {
			endGame();
		} else if (data[0] === 'dd'){
			ctx.fillStyle = 'red';
			ctx.fillRect(data[1], data[2], 5, 5);
			ctx.fillStyle = 'white';
		} else if (data[0] === 'dl'){
			drawLine(new Vector(data[1], data[2]), new Vector(data[3], data[4]), 'blue');
		}
	}
	
	socket.onclose = () => {
		console.log('GAME SOCKET CLOSED!');
		clearInterval(intervalId);
		manager?.cleanup();
		world.entities = [];
		world.systems = [];
		manager = undefined;
	}
}

function endGame() {
	clearInterval(intervalId);
	manager?.cleanup();
	world.entities = [];
	world.systems = [];
	manager = undefined;
	if (matchType === 'match') {
		setTimeout(() => showSection('menu_online_lobby', lobbyId), 2000);
	} else if (matchType === 'tournament') {
		setTimeout(() => showSection('menu_tournament_lobby', lobbyId), 2000);
	} else if (matchType === 'multiple') {
		setTimeout(() => showSection('menu_multiple_lobby', lobbyId))
	} else {
		// setTimeout(() => showSection('menu'), 2000);
		showSection('menu');
	}
}

function setupCloseLocal() {
	const logoutButton = document.getElementById('logoutButton');
	const homeButton = document.getElementById('webpong-button');

	const closeGame = () => {
		console.log("CLOSING LOCAL GAME!");
		endGame();
		homeButton.removeEventListener('click', closeGame);
		logoutButton.removeEventListener('click', closeGame);
	}

	homeButton.addEventListener('click', closeGame)
	logoutButton.addEventListener('click', closeGame);
}

function setupCloseWebsocket(socket) {
	const logoutButton = document.getElementById('logoutButton');
	const homeButton = document.getElementById('webpong-button');

	const closeSocket = () => {
		socket.close();
		homeButton.removeEventListener('click', closeSocket);
		logoutButton.removeEventListener('click', closeSocket);
        window.removeEventListener('popstate', closeSocket);
	}

	homeButton.addEventListener('click', closeSocket)
	logoutButton.addEventListener('click', closeSocket);
    window.addEventListener('popstate', closeSocket);
}

// Scoreboard stuff
// interaction with html ui elements
function createScoreItem(playerName, isLocal = false) {
	let scoreItem = document.createElement('div');
	let playerNameDiv = document.createElement('span');
	let playerScore = document.createElement('span');
	if (isLocal)
		playerNameDiv.classList.add('local-player');
	playerNameDiv.innerText = playerName;
	playerScore.innerText = 0;
	scoreItem.classList.add('score-item');
	scoreItem.appendChild(playerNameDiv);
	scoreItem.appendChild(playerScore);
	return scoreItem;
}

function initScoreBoard(playerNames, localPlayer = undefined) {
	const scoreContainer = document.querySelector('.game-container');
	let scoreItems = scoreContainer.querySelectorAll('.score-item');
	for (let i = 0; i < scoreItems.length; i++) {
		scoreItems[i].remove();
	}
	for (let i = 0; i < playerNames.length; i++) {
		scoreContainer.appendChild(createScoreItem(playerNames[i], localPlayer?.uname == playerNames[i]));
	}
}

function updateScore(idx, newScore) {
	const scoreContainer = document.querySelector('.game-container');
	let scoreItem = scoreContainer.querySelectorAll('.score-item')?.[idx];
	if (!scoreItem || scoreItem.childNodes.length < 2)
		return;
	scoreItem.childNodes[1].innerText = newScore;
}
