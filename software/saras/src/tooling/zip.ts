// A zip archive of a few small text files, stored without compression: enough to hand someone a folder.
import { crc32 } from 'node:zlib';

export interface ZipFile {
  /** Its path inside the archive, with forward slashes. */
  path: string;
  content: string;
}

interface Entry {
  name: Buffer;
  data: Buffer;
  crc: number;
  offset: number;
}

/** What comes before a file's bytes, and again in the directory at the end: its size, its checksum, its name. */
function described({ name, data, crc }: Entry): Buffer {
  const fields = Buffer.alloc(26);
  fields.writeUInt16LE(20, 0); // version needed
  fields.writeUInt16LE(0x0800, 2); // names are UTF-8
  fields.writeUInt32LE(crc, 10);
  fields.writeUInt32LE(data.length, 14);
  fields.writeUInt32LE(data.length, 18);
  fields.writeUInt16LE(name.length, 22);
  return fields;
}

const local = (entry: Entry): Buffer => Buffer.concat([Buffer.from('PK\x03\x04', 'latin1'), described(entry), entry.name, entry.data]);

function listed(entry: Entry): Buffer {
  const tail = Buffer.alloc(14);
  tail.writeUInt32LE(entry.offset, 10);
  return Buffer.concat([Buffer.from('PK\x01\x02', 'latin1'), Buffer.from([20, 0]), described(entry), tail, entry.name]);
}

function ending(count: number, directorySize: number, directoryOffset: number): Buffer {
  const end = Buffer.alloc(22);
  end.write('PK\x05\x06', 0, 'latin1');
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(directorySize, 12);
  end.writeUInt32LE(directoryOffset, 16);
  return end;
}

export function zip(files: ZipFile[]): Buffer {
  const entries: Entry[] = [];
  let offset = 0;
  for (const { path, content } of files) {
    const data = Buffer.from(content, 'utf8');
    const entry = { name: Buffer.from(path, 'utf8'), data, crc: crc32(data), offset };
    entries.push(entry);
    offset += local(entry).length;
  }
  const directory = Buffer.concat(entries.map(listed));
  return Buffer.concat([...entries.map(local), directory, ending(entries.length, directory.length, offset)]);
}
