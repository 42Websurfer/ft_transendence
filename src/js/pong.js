const canvas = document.createElement('canvas');
canvas.width = 1280;
canvas.height = 720;
const ctx = canvas.getContext('2d');
const PLAYER_MOVE_SPEED = 10;

export function renderPong() {
	const app = document.getElementById('app');
	if (app)
		app.appendChild(canvas);
}

class Vector{
	constructor(x, y){
		this.x = x;
		this.y = y;
	}

	dup(){
		return (new Vector(this.x, this.y));
	}

	add(otherVector){
		return (new Vector(this.x + otherVector.x, this.y + otherVector.y));
	}

	sub(otherVec){
		return (new Vector(this.x - otherVec.x, this.y - otherVec.y));
	}

	normalize(){
		let len = this.length();
		this.x /= len;
		this.y /= len;
		return this;
	}

	scale(size){
		this.x *= size;
		this.y *= size;
		return this;
	}

	rotate(degree) {
		const radians = degree * (Math.PI / 180);

		const cos = Math.cos(radians);
		const sin = Math.sin(radians);

		const newX = this.x * cos - this.y * sin;
		const newY = this.x * sin + this.y * cos;

		this.x = newX;
		this.y = newY;
		return this;
	}

	dot(other){
		return (this.x * other.x + this.y * other.y);
	}

	sqrLength(){
		return (Math.pow(this.x, 2) + Math.pow(this.y, 2));
	}

	length(){
		return (Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2)));
	}

}

class Plane{
	constructor(start, dir){
		this.start = start.dup();
		this.dir = dir.dup();
	}

	rotate(deg){
		this.dir.rotate(deg);
		return this;
	}

	getTangent(){
		return (new Plane(this.start, this.dir.dup().rotate(90)));
	}

	getClosestPoint(point){
		let normDir = this.dir.dup().normalize();
		let v = point.sub(this.start);
		let t = v.dot(normDir);
		t = Math.max(0, Math.min(t, this.dir.dot(normDir)));
		let cp = this.start.add(normDir.scale(t));
		return cp;
	}
}

class Transform{
	constructor(posX, posY, rotation = 0){
		this.position = new Vector(posX, posY);
		this.rotation = rotation;
		this.up = new Vector(0, -1);
		this.up.rotate(this.rotation);
	}

	rotate(deg){
		this.rotation = deg;
		this.up.rotate(deg);
	}
}

class Component{
	constructor(){

	}
}

class Physics extends Component{
	constructor(x = 0, y = 0, isStatic = false, hasGravity = true){
		super();
		this.hasGravity = hasGravity;
		this.isStatic = isStatic;
		this.velocity = new Vector(x, y);
	}

	setVelocity(dx, dy){
		this.velocity.x = dx;
		this.velocity.y = dy;
	}

	setVelocityV(vec){
		this.velocity = vec;
	}
}

class Mesh extends Component{
	constructor(isTrigger = false){
		super();
		this.isTrigger = isTrigger;
		this.points = [];
	}

	draw(transform){
		if (this.points.length == 0)
			return;
		ctx.beginPath();
		let point = new Vector(this.points[0].x, this.points[0].y)
		point.rotate(transform.rotation);
		point = point.add(transform.position);
		ctx.moveTo(point.x, point.y);
		for (let i = 1; i < this.points.length; i++) {
			point = new Vector(this.points[i].x, this.points[i].y);
			point.rotate(transform.rotation);
			point = point.add(transform.position);
			ctx.lineTo(point.x, point.y);
		}
		point = this.points[0].dup();
		point.rotate(transform.rotation);
		point = point.add(transform.position);
		ctx.lineTo(point.x, point.y);
		ctx.closePath();
		ctx.fill();
	}

	getClosestPoint(transform, point){
		let closestPoint = undefined;
		let smallestDist = Infinity;

		let transformedPoints = this.points.map(p => p.dup().rotate(transform.rotation).add(transform.position));

		for (let i = 0; i < transformedPoints.length; i++) {
			let pointA = transformedPoints[i];
			let pointB = transformedPoints[(i + 1) % transformedPoints.length];

			let planeAB = new Plane(pointA, pointB.sub(pointA));

			// drawLine(planeAB.start, planeAB.dir.add(planeAB.start));
			
			let currPoint = planeAB.getClosestPoint(point);
			let line = currPoint.sub(point);
			let dist = line.sqrLength();
			
			if (dist < smallestDist) {
				smallestDist = dist;
				closestPoint = currPoint;
			}
		}
		return (closestPoint);
	}
}

class Circle extends Mesh{
	constructor(width, isTrigger = false){
		super(isTrigger);
		this.width = this.height = width;
	}

	draw(transform){
		ctx.beginPath();
		ctx.arc(transform.position.x, transform.position.y, this.width * 0.5, 0, 360);
		ctx.closePath();
		ctx.fill();
	}

	getClosestPoint(transform, point){
		let closestPoint = point.sub(transform.position);
		closestPoint.normalize();
		closestPoint.scale(this.width * 0.5);
		closestPoint = closestPoint.add(transform.position);
		return (closestPoint);
	}
}

class Box extends Mesh{
	constructor(w, h, isTrigger = false){
		super(isTrigger);
		this.width = w;
		this.height = h;
		this.points.push(new Vector(-(this.width * 0.5), this.height * 0.5));
		this.points.push(new Vector(this.width * 0.5, this.height * 0.5));
		this.points.push(new Vector(this.width * 0.5, -(this.height * 0.5)));
		this.points.push(new Vector(-(this.width * 0.5), -(this.height * 0.5)));
	}
}


class Entity extends Transform{
	constructor(x, y){
		super(x, y);
		this.components = {};
	}

	onCollision(other, collsionPoint = undefined){

	}

	onTrigger(other, collisionPoint = undefined){

	}

	addComponent(type, component){
		// if (!(type in this.components)){
			this.components[type] = component;
		// } else {
			// this.components[type] = component;
		// }
	}

	getComponent(type){
		return this.components[type];
	}

	hasComponent(type){
		return type in this.components;
	}

	move(xAdd, yAdd){
		this.position.x += xAdd;
		this.position.y += yAdd;
	}

	update(){
	}
}

class Ball extends Entity{
	constructor(x = canvas.width / 2, y = canvas.height / 2){
		super(x, y);
		this.addComponent(Mesh, new Circle(40));
		this.physics = new Physics(0,0, false, false);
		// this.physics.hasGravity = false;
		this.addComponent(Physics, this.physics);
	}

	onCollision(other, collisionPoint = undefined){
		if (collisionPoint === undefined)
			return;
		let ba = this.position.sub(collisionPoint);
		ba.normalize();
		let tangent = new Plane(collisionPoint, ba);
		let velocityNormalized = this.physics.velocity.dup().normalize();
		let dotProduct = tangent.dir.dot(velocityNormalized);
		let reflection = velocityNormalized.sub(ba.scale(2 * dotProduct));
		reflection.scale(this.physics.velocity.length());
		this.physics.setVelocityV(reflection);
	}
}

class Player extends Entity{
	constructor(x, y){
		super(x, y);
		this.mesh = new Box(40, 250);
		this.physics = new Physics(0, 0, true, false);
		this.addComponent(Mesh, this.mesh);
		this.addComponent(Physics, this.physics);
		this.keyBinds = {up: 'ArrowUp', down: 'ArrowDown'};
		window.addEventListener('keydown', (event) => this.keyDown(event));
		window.addEventListener('keyup', (event) => this.keyUp(event));
	}

	move(xAdd, yAdd){
		let newPos = this.position.add(new Vector(xAdd, yAdd));
		for (let point of this.mesh.points) {
			point = point.add(newPos);
			if (point.x < 0 || point.x > canvas.width)
				return;
			if (point.y < 0 || point.y > canvas.height)
				return;
		}
		this.position = newPos;
	}

	// update(){
	// 	for (let point of this.mesh.points) {
	// 		point = point.add(this.position);
	// 		if (point.x < 0)
	// 			this.position.x += -point.x;
	// 		if (point.x > canvas.width)
	// 			this.position.x += canvas.width - point.x;
	// 		if (point.y < 0)
	// 			this.position.y += -point.y;
	// 		if (point.y > canvas.height)
	// 			this.position.y += canvas.height - point.y;
	// 	}
	// }

	onCollision(other, collisionPoint = undefined){
		var ophys = other.getComponent(Physics);
		if (ophys && collisionPoint && other instanceof Ball){
			let drall = collisionPoint.sub(this.position);
			let prevScale = ophys.velocity.length();
			drall = drall.add(this.physics.velocity);
			drall.normalize();
			drall.scale(10);	
			ophys.velocity = ophys.velocity.add(drall);
			ophys.velocity.normalize()
			ophys.velocity.scale(prevScale);
		}
	}

	keyDown(event){
		if (event.key === this.keyBinds.up){
			let dir = new Vector(this.up.x, this.up.y);
			dir.scale(PLAYER_MOVE_SPEED);
			this.physics.velocity = dir;
		}
		if (event.key === this.keyBinds.down) {
			let dir = new Vector(this.up.x, this.up.y);
			dir.scale(-PLAYER_MOVE_SPEED);
			this.physics.velocity = dir;
		}
		if (event.key === 'g')
			this.rotate(this.rotation + 5);
	}

	keyUp(event){
		if (event.key === this.keyBinds.up || event.key === this.keyBinds.down){
			this.physics.velocity.x = 0;
			this.physics.velocity.y = 0;
		}
	}
}

class Wall extends Entity{
	constructor(x, y, top = false){
		super(x, y);
		if (top)
			this.addComponent(Mesh, new Box(canvas.width, 5));
		else
			this.addComponent(Mesh, new Box(5, canvas.height));
	}
}

class System{
	execute(entities){}
}

class RenderSystem extends System{
	execute(entities){
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		entities.forEach(entity => {
			const mesh = entity.getComponent(Mesh);
			if (mesh){
				mesh.draw(entity);
			}
		});
	}
}

class MovementSystem extends System{
	execute(entities){
		entities.forEach(entity => {
			const phys = entity.getComponent(Physics);
			if (phys){
				if (phys.hasGravity){
					phys.setVelocity(phys.velocity.x, phys.velocity.y + 0.0981);
				}
				// ctx.fillStyle = 'red';
				// ctx.strokeStyle = 'red';
				// drawLine(entity.position, phys.velocity.dup().scale(10).add(entity.position));
				// ctx.strokeStyle = 'black';
				// ctx.fillStyle = 'black';
				entity.move(phys.velocity.x, phys.velocity.y);
			}
		});
	}
}

class CollisionSystem extends System{
	execute(entities){
		entities.forEach(currentEnt => {
			const entMesh = currentEnt.getComponent(Mesh);
			if (!entMesh)
				return ;
			if (currentEnt instanceof Ball){ //schabernack fix1
				entities.forEach(otherEnt => {
					if (currentEnt != otherEnt){
						const otherMesh = otherEnt.getComponent(Mesh);
						if (!otherMesh)
							return ;
						let ab = otherEnt.position.sub(currentEnt.position);
						let threshold = Math.max(Math.max(entMesh.width, entMesh.height), Math.max(otherMesh.width, otherMesh.height));
						if (ab.length() < threshold){
							let oClosest = otherMesh.getClosestPoint(otherEnt, currentEnt.position);
							let sClosest = entMesh.getClosestPoint(currentEnt, oClosest);
							let diff = oClosest.sub(sClosest);
							if (diff.dot(ab) < 0){
								// drawLine(currentEnt.position, sClosest, 'red');
								currentEnt.move(diff.x ,diff.y); //schabernack fix1.2
								// if (currentEnt.hasComponent(Physics)){
								// 	let phys = currentEnt.getComponent(Physics);
								// 	let ophys = otherEnt.getComponent(Physics);
								// 	if (phys.isStatic && ophys && !ophys.isStatic)
								// 		otherEnt.move(-diff.x * 2, -diff.y * 2);
								// 	// drawLine(currentEnt.position, new Vector(0,0));
								// }
								if (entMesh.isTrigger){
									currentEnt.onTrigger(otherEnt, sClosest);
								} else {
									currentEnt.onCollision(otherEnt, sClosest);
								}
								if (otherMesh.isTrigger){
									otherEnt.onTrigger(currentEnt, oClosest);
								} else {
									otherEnt.onCollision(currentEnt, oClosest);
								}
							}
						}
					}
				});
			}
		});
	}
}

class World{
	constructor(){
		this.entities = [];
		this.systems = [];
	}

	addEntity(ent){
		this.entities.push(ent);
	}

	removeEntity(ent){
		const index = this.entities.indexOf(ent);
		if (index !== -1)
			this.entities.splice(index, 1);
	}

	addSystem(sys){
		this.systems.push(sys);
	}

	update(){
		this.systems.forEach(sys => {
			sys.execute(this.entities);
		});

		this.entities.forEach(ent =>{
			ent.update();
		});
	}
}

class PongGameManager extends Entity{
	constructor(){
		super(0, 0);
		// this.players = [];
		this.player1 = new Player(canvas.width * 0.1, canvas.height * 0.5);
		this.player1.keyBinds = {up: 'w', down: 's'};
		this.player2 = new Player(canvas.width * 0.9, canvas.height * 0.5);
		this.ball = new Ball(/* canvas.width * 0.1 + 50, canvas.height * 0.2 */);
		this.roundRunning = false;
		this.scores = [0, 0];
		this.winner = -1;
		this.initGame();
	}

	initGame(){
		
		world.addEntity(this.player1);
		world.addEntity(this.player2);
		world.addEntity(this.ball);

		let wallt = new Wall(canvas.width / 2, 0, true);
		let wallb = new Wall(canvas.width / 2, canvas.height, true);
		let walll = new Wall(0, canvas.height / 2);	
		let wallr = new Wall(canvas.width, canvas.height / 2);
		walll.onCollision = (other) => {
			if (!(other instanceof Ball))
				return;
			this.scores[1]++;
			this.resetRound();
		};
		wallr.onCollision = (other) => {
			if (!(other instanceof Ball))
				return;
			this.scores[0]++;
			this.resetRound();
		};
		world.addEntity(wallt);
		world.addEntity(wallb);
		world.addEntity(walll);
		world.addEntity(wallr);

		window.addEventListener("keydown", event => {
			if(event.key == ' ' && !this.roundRunning){
				this.startRound();
				event.preventDefault();
			}
		})

	}

	drawExtra(){
		drawText(this.scores[0], canvas.width * 0.25, canvas.height * 0.25, '120px Arial');
		drawText(this.scores[1], canvas.width * 0.75, canvas.height * 0.25, '120px Arial');
		drawLine(new Vector(canvas.width * 0.5, 0), new Vector(canvas.width * 0.5, canvas.height), 'black', 10, [10, 10]);
		if (!this.roundRunning){
			if (this.winner == -1)
				drawText('Press space to start Round!', canvas.width * 0.3, canvas.height * 0.5, '48px Arial', 'red');
			else
				drawText(`Player ${this.winner+1} won!`, canvas.width * .4, canvas.height * .5, '48px Arial', 'green');
		}
	}

	checkWinCondition(){
		for (let i = 0; i < this.scores.length; i++) {
			const currScore = this.scores[i];
			if (currScore >= 7)
				return i;
		}
		return -1;
	}

	resetGame(){
		this.scores.fill(0);
		this.winner = -1;
	}

	resetRound(){
		this.winner = this.checkWinCondition(); 
		this.roundRunning = false;
		this.ball.physics.setVelocity(0,0);
		this.ball.position.x = canvas.width / 2;
		this.ball.position.y = canvas.height / 2;
	}

	startRound(){
		if (this.winner != -1)
			this.resetGame();
		this.roundRunning = true;
		if (this.scores[0] < this.scores[1])
			this.ball.physics.setVelocity(15, 0);
		else
			this.ball.physics.setVelocity(-15, 0);
	}

	update(){
		this.drawExtra();
		// console.log("GAMEMODE UPDATE!");
	}
}

function drawText(text, x, y, textStyle = undefined, colour = 'black'){
	let save = ctx.font;
	let saveStyle = ctx.fillStyle;
	if (textStyle)
		ctx.font = textStyle;
	ctx.fillStyle = colour;
	ctx.fillText(text, x, y);
	ctx.fillStyle = saveStyle;
	ctx.font = save;
}

function drawLine(p1, p2, color = 'black', lineWidth = 1, dashPattern = [], debug = false){
	ctx.beginPath();
	ctx.moveTo(p1.x, p1.y);
	if (debug){
		let mid = p2.sub(p1);
		let len = mid.length();
		mid.scale(0.5);
		mid = p1.add(mid);
		ctx.fillText(len, mid.x, mid.y);
		ctx.fillRect(p2.x, p2.y, 5, 5);
	}
	ctx.lineTo(p2.x, p2.y);
	ctx.closePath();

	let savestroke = ctx.strokeStyle;
	let savefill = ctx.fillStyle;
	let savewidth = ctx.lineWidth;
	let savePattern = ctx.getLineDash();

	ctx.lineWidth = lineWidth;
	ctx.setLineDash(dashPattern);
	ctx.fillStyle = color;
	ctx.strokeStyle = color;
	ctx.stroke();
	ctx.fillStyle = savefill;
	ctx.strokeStyle = savestroke;
	ctx.lineWidth = savewidth;
	ctx.setLineDash(savePattern);
}


let world = new World();

world.addSystem(new RenderSystem());
world.addSystem(new CollisionSystem());
world.addSystem(new MovementSystem());

world.addEntity(new PongGameManager());

setInterval(function() {
	world.update();
}, 10);

// let players = 3;
// let rotStep = 360 / players;
// const cent = new Vector(canvas.width/2, canvas.height/2);
// let ls1 = new Vector(0, -(canvas.height / 2));
// let ls2 = new Vector(0, -(canvas.height / 2));
// ls2.rotate(rotStep);

// for (let index = 0; index < players; index++) {
// 	let p1 = ls1.add(cent);
// 	let p2 = ls2.add(cent);
// 	ctx.fillRect(p1.x, p1.y, 5, 5);
// 	ctx.fillRect(p2.x, p2.y, 5, 5);
// 	ctx.beginPath();
// 	ctx.moveTo(p1.x, p1.y);
// 	ctx.lineTo(p2.x, p2.y);
// 	ctx.stroke();
// 	ctx.closePath();
// 	ls1.rotate(rotStep);
// 	ls2.rotate(rotStep);
// }
