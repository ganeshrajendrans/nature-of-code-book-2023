// The Nature of Code
// Daniel Shiffman
// http://natureofcode.com

let emitter;

function setup() {
  createCanvas(640, 240);
  emitter = new Emitter(width / 2, 50);
}

function draw() {
  background(255);

  // Apply gravity force to all Particles
  let gravity = createVector(0, 0.1);
  emitter.applyForce(gravity);

  emitter.addParticle();
  emitter.run();
}