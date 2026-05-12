import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

let container, labelContainer;
let camera, scene, renderer, light;
let liveLabel;

let hitTestSource = null;
let hitTestSourceRequested = false;

let reticle;

let width, height;

function getSurfaceNormal(matrix) {
  return new THREE.Vector3(
    matrix.elements[4],
    matrix.elements[5],
    matrix.elements[6]
  ).normalize();
}

function getCameraPosition() {
  const camMatrix = renderer.xr.getCamera(camera).matrixWorld;
  return new THREE.Vector3().setFromMatrixPosition(camMatrix);
}

function getPerpendicularDistance(hitMatrix) {
  const hitPoint = new THREE.Vector3().setFromMatrixPosition(hitMatrix);
  const normal = getSurfaceNormal(hitMatrix);
  const camPos = getCameraPosition();
  const camToHit = new THREE.Vector3().subVectors(hitPoint, camPos);
  return Math.abs(camToHit.dot(normal));
}

function initReticle() {
  let ring = new THREE.RingBufferGeometry(0.045, 0.05, 32).rotateX(- Math.PI / 2);
  let dot = new THREE.CircleBufferGeometry(0.005, 32).rotateX(- Math.PI / 2);
  reticle = new THREE.Mesh(
    BufferGeometryUtils.mergeBufferGeometries([ring, dot]),
    new THREE.MeshBasicMaterial()
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
}

function initLabelContainer() {
  labelContainer = document.createElement('div');
  labelContainer.style.position = 'absolute';
  labelContainer.style.top = '0px';
  labelContainer.style.pointerEvents = 'none';
  labelContainer.setAttribute('id', 'container');
}

function initCamera() {
  camera = new THREE.PerspectiveCamera(70, width / height, 0.01, 20);
}

function initLight() {
  light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  light.position.set(0.5, 1, 0.25);
}

function initScene() {
  scene = new THREE.Scene();
}

function initXR() {
  container = document.createElement('div');
  document.body.appendChild(container);

  width = window.innerWidth;
  height = window.innerHeight;

  initScene();

  initCamera();

  initLight();
  scene.add(light);

  initRenderer()
  container.appendChild(renderer.domElement);

  initLabelContainer()
  container.appendChild(labelContainer);
  liveLabel = document.createElement('div');
  liveLabel.setAttribute('id', 'live-label');
  liveLabel.textContent = 'Searching for surface...';
  labelContainer.appendChild(liveLabel);

  document.body.appendChild(ARButton.createButton(renderer, {
    optionalFeatures: ["dom-overlay"],
    domOverlay: {root: document.querySelector('#container')}, 
    requiredFeatures: ['hit-test']
  }));

  initReticle();
  scene.add(reticle);

  window.addEventListener('resize', onWindowResize, false);
  animate()
}

function onWindowResize() {
  width = window.innerWidth;
  height = window.innerHeight;
  camera.aspect = width/height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  if (frame) {
    let referenceSpace = renderer.xr.getReferenceSpace();
    let session = renderer.xr.getSession();
    if (hitTestSourceRequested === false) {
      session.requestReferenceSpace('viewer').then(function (referenceSpace) {
        session.requestHitTestSource({ space: referenceSpace }).then(function (source) {
          hitTestSource = source;
        });
      });
      session.addEventListener('end', function () {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });
      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      let hitTestResults = frame.getHitTestResults(hitTestSource);
      if (hitTestResults.length) {
        let hit = hitTestResults[0];
        reticle.visible = true;
        reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
        const distM = getPerpendicularDistance(reticle.matrix);
        const distCm = Math.round(distM * 100);
        liveLabel.textContent = distCm + ' cm';
      } else {
        reticle.visible = false;
        liveLabel.textContent = 'Searching for surface...';
      }
    } else {
      liveLabel.textContent = 'Searching for surface...';
    }

  }
  renderer.render(scene, camera);
}

export { initXR }
