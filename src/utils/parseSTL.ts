import * as THREE from 'three';

export function parseSTL(buffer: ArrayBuffer): {
  geometry: THREE.BufferGeometry;
  format: 'ascii' | 'binary';
  triangleCount: number;
} {
  const textDecoder = new TextDecoder();
  const header = textDecoder.decode(buffer.slice(0, 80)).trim();

  const isASCII = header.startsWith('solid') && !header.includes('binary');

  if (isASCII) {
    const text = textDecoder.decode(buffer);
    const { geometry, triangleCount } = parseASCII(text);
    return {
      geometry,
      format: 'ascii',
      triangleCount,
    };
  } else {
    const { geometry, triangleCount } = parseBinary(buffer);
    return {
      geometry,
      format: 'binary',
      triangleCount,
    };
  }
}

function parseBinary(buffer: ArrayBuffer): {
  geometry: THREE.BufferGeometry;
  triangleCount: number;
} {
  const dv = new DataView(buffer);
  const faces = dv.getUint32(80, true); // triangle count
  const positions: number[] = [];
  const normals: number[] = [];
  let offset = 84;

  for (let i = 0; i < faces; i++) {
    const nx = dv.getFloat32(offset, true);
    const ny = dv.getFloat32(offset + 4, true);
    const nz = dv.getFloat32(offset + 8, true);
    offset += 12;

    for (let j = 0; j < 3; j++) {
      positions.push(
        dv.getFloat32(offset, true),
        dv.getFloat32(offset + 4, true),
        dv.getFloat32(offset + 8, true)
      );
      normals.push(nx, ny, nz);
      offset += 12;
    }

    offset += 2; // skip attribute byte count
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

  return {
    geometry,
    triangleCount: faces,
  };
}

function parseASCII(text: string): {
  geometry: THREE.BufferGeometry;
  triangleCount: number;
} {
  const pattern = /facet\s+normal\s+([eE\d\.\+\-]+)\s+([eE\d\.\+\-]+)\s+([eE\d\.\+\-]+)[\s\S]*?vertex\s+([eE\d\.\+\-]+)\s+([eE\d\.\+\-]+)\s+([eE\d\.\+\-]+)[\s\S]*?vertex\s+([eE\d\.\+\-]+)\s+([eE\d\.\+\-]+)\s+([eE\d\.\+\-]+)[\s\S]*?vertex\s+([eE\d\.\+\-]+)\s+([eE\d\.\+\-]+)\s+([eE\d\.\+\-]+)/g;

  const positions: number[] = [];
  const normals: number[] = [];
  let triangleCount = 0;

  let result;
  while ((result = pattern.exec(text)) !== null) {
    triangleCount++;
    const normal = result.slice(1, 4).map(Number);
    const vertices = result.slice(4).map(Number);

    for (let i = 0; i < 3; i++) {
      positions.push(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
      normals.push(...normal);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

  return {
    geometry,
    triangleCount,
  };
}
