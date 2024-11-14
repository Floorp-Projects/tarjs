import { TarFileType } from './constants';
import { ITarFileInfo } from './types';
import { utf8Decode, getArrayBuffer } from './util';

export class TarReader {
  static async load(file: ArrayBuffer | Uint8Array | Blob) {
    const buffer = await getArrayBuffer(file);
    const fileInfos = loadTarFile(buffer);
    return new TarReader(buffer, fileInfos);
  }

  #buffer: ArrayBuffer;

  constructor(
    buffer: ArrayBuffer,
    public fileInfos: ITarFileInfo[],
  ) {
    this.#buffer = buffer;
  }

  getTextFile(filename: string) {
    const item = this.fileInfos.find((info) => info.name === filename);
    if (!item) throw new Error(`File not found: ${filename}`);
    return readTextFile(this.#buffer, item.headerOffset + 512, item.size);
  }

  getFileBlob(filename: string, mimetype = '') {
    const item = this.fileInfos.find((info) => info.name === filename);
    if (!item) throw new Error(`File not found: ${filename}`);
    return readFileBlob(
      this.#buffer,
      item.headerOffset + 512,
      item.size,
      mimetype,
    );
  }
}

export function loadTarFile(buffer: ArrayBuffer) {
  const fileInfos: ITarFileInfo[] = [];
  let offset = 0;
  while (offset < buffer.byteLength - 512) {
    const fileName = readFileName(buffer, offset);
    if (!fileName) break;
    const fileType = readFileType(buffer, offset);
    const fileSize = readFileSize(buffer, offset);
    const fileUid = readFileUid(buffer, offset);
    const fileGid = readFileGid(buffer, offset);
    const fileMode = readFileMode(buffer, offset);
    const fileUname = readFileUname(buffer, offset);
    const fileGname = readFileGname(buffer, offset);

    fileInfos.push({
      name: fileName,
      type: fileType,
      size: fileSize,
      uid: fileUid,
      gid: fileGid,
      mode: fileMode,
      user: fileUname,
      group: fileGname,
      headerOffset: offset,
    });

    offset += 512 + 512 * Math.floor((fileSize + 511) / 512);
  }
  return fileInfos;
}

function readString(buffer: ArrayBuffer, offset: number, maxSize: number) {
  let size = 0;
  let view = new Uint8Array(buffer, offset, maxSize);
  while (size < maxSize && view[size]) size += 1;
  view = new Uint8Array(buffer, offset, size);
  return utf8Decode(view);
}

function readFileName(buffer: ArrayBuffer, offset: number) {
  return readString(buffer, offset, 100);
}

function readFileType(buffer: ArrayBuffer, offset: number) {
  // offset = 156, length = 1
  const view = new Uint8Array(buffer, offset + 156, 1);
  return view[0] as TarFileType;
}

function readFileSize(buffer: ArrayBuffer, offset: number) {
  // offset = 124, length = 12
  const view = new Uint8Array(buffer, offset + 124, 12);
  const sizeStr = utf8Decode(view);
  return parseInt(sizeStr, 8);
}

function readFileUid(buffer: ArrayBuffer, offset: number) {
  // offset = 108, length = 8
  const view = new Uint8Array(buffer, offset + 108, 8);
  const uidStr = utf8Decode(view);
  return parseInt(uidStr, 8);
}

function readFileGid(buffer: ArrayBuffer, offset: number) {
  // offset = 116, length = 8
  const view = new Uint8Array(buffer, offset + 116, 8);
  const gidStr = utf8Decode(view);
  return parseInt(gidStr, 8);
}

function readFileMode(buffer: ArrayBuffer, offset: number) {
  // offset = 100, length = 8
  const view = new Uint8Array(buffer, offset + 100, 8);
  const modeStr = utf8Decode(view);
  return parseInt(modeStr);
}

function readFileUname(buffer: ArrayBuffer, offset: number) {
  // offset = 265, length = 32
  return readString(buffer, offset + 265, 32);
}

function readFileGname(buffer: ArrayBuffer, offset: number) {
  // offset = 297, length = 32
  return readString(buffer, offset + 297, 32);
}

export function readFileBlob(
  buffer: ArrayBuffer,
  offset: number,
  size: number,
  mimetype: string,
) {
  const view = new Uint8Array(buffer, offset, size);
  return new Blob([view], { type: mimetype });
}

export function readTextFile(
  buffer: ArrayBuffer,
  offset: number,
  size: number,
) {
  const view = new Uint8Array(buffer, offset, size);
  return utf8Decode(view);
}
