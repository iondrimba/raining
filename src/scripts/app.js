import 'styles/index.scss';
import { map, distance, hexToRgbTreeJs } from './helpers';

export default class App {
  setup() {
    this.gui = new dat.GUI();
    this.backgroundColor = '#faff06';
    this.gutter = { size: 0 };
    this.meshes = [];
    this.grid = { cols: 30, rows: 30 };
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.velocity = -.1;
    this.angle = 0;
    this.amplitude = .1;
    this.radius = 1;
    this.waveLength = 200;
    this.ripple = {};
    this.interval = 0;
    this.waterDropPositions = [];
    this.ripples = [];

    const gui = this.gui.addFolder('Background');

    gui.addColor(this, 'backgroundColor').onChange((color) => {
      document.body.style.backgroundColor = color;
    });

    window.addEventListener('resize', this.onResize.bind(this), { passive: true });

    window.addEventListener('visibilitychange', (evt) => {
      this.pause = evt.target.hidden;
    }, false);
  }


  createScene() {
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    document.body.appendChild(this.renderer.domElement);
  }

  createCamera() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(10, width / height, 1, 1000);
    this.camera.position.set(-180, 180, 180);

    this.scene.add(this.camera);
  }

  addAmbientLight() {
    const obj = { color: '#fff' };
    const light = new THREE.AmbientLight(obj.color, 1);

    this.scene.add(light);
  }

  addSpotLight() {
    const obj = { color: '#fff' };
    const light = new THREE.SpotLight(obj.color, 1);

    light.position.set(0, 50, 0);
    light.castShadow = true;

    this.scene.add(light);
  }

  addPointLight(color, position) {
    const pointLight = new THREE.PointLight(color, 1, 1000, 1);
    pointLight.position.set(position.x, position.y, position.z);

    this.scene.add(pointLight);
  }

  createGrid() {
    this.groupMesh = new THREE.Object3D();

    const meshParams = {
      color: '#1643e5',
      metalness: .3,
      emissive: '#000000',
      roughness: 1,
    };


    const material = new THREE.MeshPhysicalMaterial(meshParams);

    const gui = this.gui.addFolder('Water');

    gui.addColor(meshParams, 'color').onChange((color) => {
      material.color = hexToRgbTreeJs(color);
    });


    for (let row = 0; row < this.grid.rows; row++) {
      this.meshes[row] = [];

      for (let col = 0; col < this.grid.cols; col++) {
        const geometry = new THREE.BoxBufferGeometry(1, 1, 1);
        const mesh = this.getMesh(geometry, material);
        mesh.position.y = 0;
        mesh.name = `cube-${row}-${col}`;

        const pivot = new THREE.Object3D();
        const x = col + (col * this.gutter.size);
        const z = row + (row * this.gutter.size);

        pivot.add(mesh);
        pivot.scale.set(1, 1, 1);
        pivot.position.set(x, 0, z);

        this.meshes[row][col] = pivot;

        this.groupMesh.add(pivot);
      }
    }

    const centerX = ((this.grid.cols) + ((this.grid.cols) * this.gutter.size)) * .4;
    const centerZ = ((this.grid.rows) + ((this.grid.rows) * this.gutter.size)) * .6;

    this.groupMesh.position.set(-centerX, 1, -centerZ);

    this.scene.add(this.groupMesh);

    for (let row = 0; row < this.grid.rows; row++) {
      for (let col = 0; col < this.grid.cols; col++) {
        const x = col + (col * this.gutter.size);
        const z = row + (row * this.gutter.size);

        this.waterDropPositions.push({ x: x + this.groupMesh.position.x, z: z + this.groupMesh.position.z });
      }
    }
  }

  getMesh(geometry, material) {
    const mesh = new THREE.Mesh(geometry, material);

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  addCameraControls() {
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
  }

  addFloor() {
    const geometry = new THREE.PlaneGeometry(100, 100);
    const material = new THREE.ShadowMaterial({ opacity: .3 });

    this.floor = new THREE.Mesh(geometry, material);
    this.floor.name = 'floor';
    this.floor.position.y = -1;
    this.floor.rotateX(- Math.PI / 2);
    this.floor.receiveShadow = true;

    this.scene.add(this.floor);
  }

  onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  addWaterDrop(geometry, material) {
    const waterDrop = new THREE.Mesh(geometry, material);

    return waterDrop;
  }

  getRandomWaterDropPosition() {
    return this.waterDropPositions[Math.floor(Math.random() * Math.floor(this.waterDropPositions.length))];
  }

  animateWaterDrops() {
    const meshParams = {
      color: '#6ad2ff',
      metalness: 0,
      emissive: '#000000',
      roughness: 1,
    };

    const geometry = new THREE.BoxBufferGeometry(.5, 2, .5);
    const material = new THREE.MeshStandardMaterial(meshParams);

    const gui = this.gui.addFolder('Drop');

    gui.addColor(meshParams, 'color').onChange((color) => {
      material.color = hexToRgbTreeJs(color);
    });


    this.interval = setInterval(() => {
      const waterDrop = this.addWaterDrop(geometry, material);
      const { x, z } = this.getRandomWaterDropPosition();

      waterDrop.position.set(x, 50, z);
      this.scene.add(waterDrop);

      if (this.pause) {
        this.scene.remove(waterDrop);
        TweenMax.killAll(true);
      } else {
        TweenMax.to(waterDrop.position, .5, {
          ease: Sine.easeIn,
          y: -2,
          onUpdate: () => {
            if (waterDrop.position.y < 1 ) {
              this.ripples.push({ x, z, velocity: -1, angle: 0, amplitude: .1, radius: 1, motion: -.7 });
            }
          },
          onComplete: () => {
            waterDrop.position.set(0, 50, 0);
            this.scene.remove(waterDrop);
          }
        });
      }
    }, 100);
  }

  draw() {
    for (let row = 0; row < this.grid.rows; row++) {
      for (let col = 0; col < this.grid.cols; col++) {
        for (let ripple = 0; ripple < this.ripples.length; ripple++) {
          const r = this.ripples[ripple];
          const dist = distance(col, row, r.x - this.groupMesh.position.x, r.z - this.groupMesh.position.z);

          if (dist < r.radius) {
            const offset = map(dist, 0, -this.waveLength, -100, 100);
            const angle = r.angle + offset;
            const y = map(Math.sin(angle), -1, 0, r.motion > 0 ? 0 : r.motion, 0);

            this.meshes[row][col].position.y = y;
          }
        }
      }
    }

    for (let ripple = 0; ripple < this.ripples.length; ripple++) {
      const r = this.ripples[ripple];

      r.angle -= this.velocity * 2;
      r.radius -= this.velocity * 3;
      r.motion -= this.velocity / 5;

      if (r.radius > 50) {
        this.ripples.shift();
      }
    }
  }

  animate() {
    this.controls.update();

    this.draw();

    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(this.animate.bind(this));
  }

  init() {
    this.setup();

    this.createScene();

    this.createCamera();

    this.addAmbientLight();

    this.addSpotLight();

    this.createGrid();

    this.addCameraControls();

    this.addFloor();

    this.animate();

    this.draw();

    this.animateWaterDrops();
  }
}
