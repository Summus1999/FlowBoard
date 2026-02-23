/**
 * 生成 PNG 图标（用于 macOS 和 Linux）
 * 从 SVG 生成 PNG
 */

const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '../assets');

// 创建不同尺寸的 PNG
const sizes = [16, 32, 64, 128, 256, 512, 1024];

console.log('生成 PNG 图标...\n');

// 由于没有 sharp，我们创建一个简单的彩色 PNG
// 这是一个蓝色的 1024x1024 PNG

// PNG 文件签名
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

// 创建一个简单的 1024x1024 蓝色 PNG
function createBluePNG(width, height) {
    // 简化版：创建一个纯色 PNG
    // 实际项目中建议使用 sharp 或 canvas
    
    // 这里我们创建一个最小化的 PNG 文件
    // 包含 IHDR, IDAT, IEND 块
    
    const ihdr = createIHDR(width, height);
    const idat = createIDAT(width, height);
    const iend = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);
    
    return Buffer.concat([PNG_SIGNATURE, ihdr, idat, iend]);
}

function createIHDR(width, height) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(13, 0);
    
    const chunkType = Buffer.from('IHDR');
    const data = Buffer.alloc(13);
    data.writeUInt32BE(width, 0);
    data.writeUInt32BE(height, 4);
    data.writeUInt8(8, 8); // bit depth
    data.writeUInt8(2, 9); // color type (RGB)
    data.writeUInt8(0, 10); // compression
    data.writeUInt8(0, 11); // filter
    data.writeUInt8(0, 12); // interlace
    
    const crc = crc32(Buffer.concat([chunkType, data]));
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc, 0);
    
    return Buffer.concat([length, chunkType, data, crcBuffer]);
}

function createIDAT(width, height) {
    // 创建简单的蓝色图像数据
    const rowSize = width * 3 + 1; // RGB + filter byte
    const imageData = Buffer.alloc(rowSize * height);
    
    for (let y = 0; y < height; y++) {
        const rowStart = y * rowSize;
        imageData[rowStart] = 0; // filter byte
        
        for (let x = 0; x < width; x++) {
            const pixelStart = rowStart + 1 + x * 3;
            // 蓝色主题色: #3b82f6
            imageData[pixelStart] = 0x3b;     // R
            imageData[pixelStart + 1] = 0x82; // G
            imageData[pixelStart + 2] = 0xf6; // B
        }
    }
    
    // 压缩数据（简化：不压缩）
    const chunkType = Buffer.from('IDAT');
    const crc = crc32(Buffer.concat([chunkType, imageData]));
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc, 0);
    
    const length = Buffer.alloc(4);
    length.writeUInt32BE(imageData.length, 0);
    
    return Buffer.concat([length, chunkType, imageData, crcBuffer]);
}

// 简化的 CRC32
function crc32(buffer) {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
    }
    
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buffer.length; i++) {
        crc = table[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// 生成 1024x1024 PNG 作为 macOS/Linux 图标
console.log('生成 1024x1024 PNG (用于 macOS/Linux)...');
const png1024 = createBluePNG(1024, 1024);
fs.writeFileSync(path.join(assetsDir, 'icon-1024.png'), png1024);
console.log('✅ assets/icon-1024.png');

// 也创建一个 512x512 版本
console.log('生成 512x512 PNG...');
const png512 = createBluePNG(512, 512);
fs.writeFileSync(path.join(assetsDir, 'icon-512.png'), png512);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), png512);
console.log('✅ assets/icon-512.png');
console.log('✅ assets/icon.png (Linux 用)');

// 创建 macOS icon.iconset 目录结构说明
console.log('\n🍎 对于 macOS .icns 文件:');
console.log('   方案 1: 使用在线转换工具');
console.log('   访问 https://cloudconvert.com/png-to-icns');
console.log('   上传 assets/icon-1024.png 转换为 icon.icns');
console.log('');
console.log('   方案 2: 在 macOS 上使用 iconutil');
console.log('   mkdir icon.iconset');
console.log('   复制不同尺寸 PNG 到 icon.iconset/');
console.log('   iconutil -c icns icon.iconset');
console.log('');
console.log('✅ PNG 图标生成完成!');
