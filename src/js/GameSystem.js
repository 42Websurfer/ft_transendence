export const canvas = document.createElement('canvas');
canvas.width = 1280;
canvas.height = 780;
export const ctx = canvas.getContext('2d');


export class Vector{
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

	cross(other) {
		return (this.y * other.x - this.x * other.y);
	}

	sqrLength(){
		return (Math.pow(this.x, 2) + Math.pow(this.y, 2));
	}

	length(){
		return (Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2)));
	}

	lerp(other, alpha) {
		return new Vector(
			this.x + (other.x - this.x) * alpha,
			this.y + (other.y - this.y) * alpha
		);
	}
}

export class Plane{
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

	length() {
		return (this.dir.length());
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

export class Transform{
	constructor(posX, posY, rotation = 0){
		this.position = new Vector(posX, posY);
		this.rotation = rotation;
		this.up = new Vector(0, -1);
		this.up.rotate(this.rotation);
	}

	getData(){
		return ({
			position: 
			{
				x: this.position.x,
				y: this.position.y
			},
			rotation: this.rotation
			});
	}

	rotate(deg){
		this.up.rotate(deg - this.rotation);
		this.rotation = deg;
	}
}

/**
 * Abstract class Component
 * Base for all componets using Entity Component System
 */
export class Component{
	constructor(){

	}
}

/**
 * Physics component
 * responsible for storing Entitys movement direction
 */
export class Physics extends Component{
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

/**
 * Mesh component
 * Contains all the points of the mesh.
 * The points are relative to the center of the Mesh
 * World position will be added each draw by passing the Entitys transform data
 * comes with a generic draw function for Meshes with more than 2 points
 * Draw can be overloaded like in the Circle class, which does not need points
 */
export class Mesh extends Component{
	constructor(isTrigger = false, colour = 'white'){
		super();
		this.isTrigger = isTrigger;
		this.colour = colour;
		this.points = [];
	}

	draw(transform){
		if (this.points.length == 0)
			return;
		let prevFillStyle = ctx.fillStyle;
		ctx.fillStyle = this.colour;
		ctx.beginPath();

		let transformedPoints = this.points.map(p => p.dup().rotate(transform.rotation).add(transform.position));

		let point = new Vector(transformedPoints[0].x, transformedPoints[0].y)
		ctx.moveTo(point.x, point.y);
		for (let i = 1; i < transformedPoints.length; i++) {
			point = transformedPoints[i];
			ctx.lineTo(point.x, point.y);
		}
		point = transformedPoints[0];
		ctx.lineTo(point.x, point.y);
		ctx.closePath();
		ctx.fill();
		ctx.fillStyle = prevFillStyle;
	}

	/**
	 * 
	 * @param {Transform} transform entity transform
	 * @param {Vector} point the point to get closest to
	 * @returns point on one of the meshes edges closes to the given point
	 */
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

export class Circle extends Mesh{
	constructor(width, isTrigger = false){
		super(isTrigger);
		this.width = this.height = width;
	}

	draw(transform){
		let prevFillStyle = ctx.fillStyle;
		ctx.fillStyle = this.colour;
		ctx.beginPath();
		ctx.arc(transform.position.x, transform.position.y, this.width * 0.5, 0, 360);
		ctx.closePath();
		ctx.fill();
		ctx.fillStyle = prevFillStyle;
	}

	getClosestPoint(transform, point){
		let closestPoint = point.sub(transform.position);
		closestPoint.normalize();
		closestPoint.scale(this.width * 0.5);
		closestPoint = closestPoint.add(transform.position);
		return (closestPoint);
	}
}

export class Box extends Mesh{
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

/**
 * Entity
 */
export class Entity extends Transform{
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

	setPos(x, y) {
		this.position.x = x;
		this.position.y = y;
	}

	update(){
	}
}

export class System{
	execute(entities){}
}

export class RenderSystem extends System{
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

export class MovementSystem extends System{
	execute(entities){
		entities.forEach(entity => {
			const phys = entity.getComponent(Physics);
			if (phys){
				if (phys.hasGravity){
					phys.setVelocity(phys.velocity.x, phys.velocity.y + 0.0981);
				}
				entity.move(phys.velocity.x, phys.velocity.y);
			}
		});
	}
}

const eps = 0.00001;

export class Ray extends Plane {
	constructor(start, dir) {
		super(start, dir);
	}

	cast(entities, debug = false) {
		const start = this.start;
		const end = this.start.add(this.dir);
		if (debug)
			drawLine(start, end, 'red');
		let points = [];
		for (let ent of entities) {
			const entMesh = ent.getComponent(Mesh);
			if (!entMesh)
				continue;
			let transformedPoints = entMesh.points.map(p => p.dup().rotate(ent.rotation).add(ent.position));
			for (let i = 0; i < transformedPoints.length; i++) {
				let A = transformedPoints[i];
				let B = transformedPoints[(i + 1) % transformedPoints.length];
	
				const denominator = (end.x - start.x) * (B.y - A.y) - (B.x - A.x) * (end.y - start.y);

				const r = ((B.x - A.x) * (start.y - A.y) - (start.x - A.x) * (B.y - A.y)) / denominator;

				if (r + eps < 0){
					continue;
				}

				const s = ((A.x - start.x) * (end.y - start.y) - (end.x - start.x) * (A.y - start.y)) / denominator;

				if (s + eps < 0 || s - eps > 1){
					continue;
				}

				points.push(new Vector(s * (B.x - A.x) + A.x, s * (B.y - A.y) + A.y));
				if (debug)
					ctx.fillRect(points[points.length - 1].x, points[points.length - 1].y, 5, 5);
			}
		}
		points.sort((a, b) => a.sub(start).sqrLength() - b.sub(start).sqrLength());
		return points;
	}

	castInfo(entities, debug = false) {
		const start = this.start;
		const end = this.start.add(this.dir);
		if (debug)
			drawLine(start, end, 'red');
		let points = [];
		for (let ent of entities) {
			const entMesh = ent.getComponent(Mesh);
			if (!entMesh)
				continue;
			let transformedPoints = entMesh.points.map(p => p.dup().rotate(ent.rotation).add(ent.position));
			for (let i = 0; i < transformedPoints.length; i++) {
				let A = transformedPoints[i];
				let B = transformedPoints[(i + 1) % transformedPoints.length];
	
				const denominator = (end.x - start.x) * (B.y - A.y) - (B.x - A.x) * (end.y - start.y);

				const r = ((B.x - A.x) * (start.y - A.y) - (start.x - A.x) * (B.y - A.y)) / denominator;

				if (r + eps < 0){
					continue;
				}

				const s = ((A.x - start.x) * (end.y - start.y) - (end.x - start.x) * (A.y - start.y)) / denominator;

				if (s + eps < 0 || s - eps > 1){
					continue;
				}

				points.push({hitPos: new Vector(s * (B.x - A.x) + A.x, s * (B.y - A.y) + A.y), entity: ent, plane: new Plane(A.dup(), B.sub(A))});
				if (debug)
					ctx.fillRect(points[points.length - 1].hitPos.x, points[points.length - 1].hitPos.y, 5, 5);
			}
		}
		points.sort((a, b) => a.hitPos.sub(start).sqrLength() - b.hitPos.sub(start).sqrLength());
		return points[0];
	}
}

export class CollisionSystem extends System{
	execute(entities){
		for (let currentEnt of entities){
			const entMesh = currentEnt.getComponent(Mesh);
			const entPhys = currentEnt.getComponent(Physics);
			if (!entMesh || !entPhys)
				return ;
			for (let otherEnt of entities){
				if (currentEnt != otherEnt){
					const otherMesh = otherEnt.getComponent(Mesh);
					if (!otherMesh)
						return ;
					const steps = Math.ceil(entPhys.velocity.length() / Math.max(entMesh.width * 0.5, entMesh.height * 0.5));
					for (let i = 0; i <= steps; i++) {
						const t = i / steps;
						const currentPos = currentEnt.position.add(entPhys.velocity.dup().scale(t));
						const otherPos = otherEnt.position;
						let ab = otherPos.sub(currentPos);
						let threshold = Math.max(entMesh.width, entMesh.height, otherMesh.width, otherMesh.height) * 0.5;
					
						if (ab.length() < threshold){
							const stepTransform = new Transform(currentPos.x, currentPos.y, currentEnt.rotation);
							let oClosest = otherMesh.getClosestPoint(otherEnt, currentPos);
							let sClosest = entMesh.getClosestPoint(stepTransform, oClosest);
							let diff = oClosest.sub(sClosest);
							if (diff.dot(ab) < 0) {
								if (!entPhys.isStatic){
									currentEnt.setPos(currentPos.x, currentPos.y);
									currentEnt.move(diff.x, diff.y);
								}
								const ophys = otherEnt.getComponent(Physics);
								if (ophys && !ophys.isStatic){
									otherEnt.move(-diff.x, -diff.y)
								}
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
								break;
							}
						}
					}
				}
			}
		}
	}
}

export class World{
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

export function drawText(text, x, y, textStyle = undefined, colour = 'black'){
	let save = ctx.font;
	let saveStyle = ctx.fillStyle;
	if (textStyle)
		ctx.font = textStyle;
	ctx.fillStyle = colour;
	ctx.fillText(text, x, y);
	ctx.fillStyle = saveStyle;
	ctx.font = save;
}

export function strokeText(text, x, y, textStyle = undefined, colour = 'black'){
	let save = ctx.font;
	let saveStyle = ctx.strokeStyle;
	if (textStyle)
		ctx.font = textStyle;
	ctx.strokeStyle = colour;
	ctx.strokeText(text, x, y);
	ctx.strokeStyle = saveStyle;
	ctx.font = save;
}

export function drawLine(p1, p2, color = 'black', lineWidth = 1, dashPattern = [], debug = false){
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
