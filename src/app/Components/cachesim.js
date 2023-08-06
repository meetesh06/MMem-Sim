// class Cache {
//   no_cache_lines=10;
//   storage[lines][];
// };


// class AllocaRange {
//     address;
//     size;
// };

//
// Memory can read/write 4-byte integers
//  1. Has a store to store bytes of data
//  2. Given an address it can read/write a byte at a particular location
//  3. "alloca" can reserve memory, when it does that it remembers the starting address and the size allocated
//         1. For simplicity, each byte has a unique 16bit address, and when alloca is called, it stores all the associated addresses in an allocated store array
//         2. When any address in an allocated pool is freed, the entire section of reserved memory is removed.
//


const getPaddedRepString = (number, base, bits) => {
  let rep = parseInt(number).toString(base);
  let leading = ""
  if (rep.length < bits) {
    for (let i = 0; i < bits - rep.length; i++) {
      leading += "0" 
    }
  }
  return leading + rep
}

class Memory {
  constructor(size_in_bytes, start = 0) {
    this.vmem = {};
    this.start = start;
    this.size_in_bytes = size_in_bytes;
    for (let i = start; i < size_in_bytes + start; i++) {
      this.vmem[i] = new Uint8Array(1);
      // each element can store 0-255
      this.vmem[i] = 255;
    }
  }

  clear() {
    for (let i = this.start; i < this.size_in_bytes + this.start; i++) {
      this.vmem[i] = new Uint8Array(1);
      // each element can store 0-255
      this.vmem[i] = 255;
    }
  }

  // Read an integer
  readInt(address) {
    let valRead = ""
    valRead += getPaddedRepString(this.vmem[address], 2, 8);
    valRead += getPaddedRepString(this.vmem[address+1], 2, 8);
    valRead += getPaddedRepString(this.vmem[address+2], 2, 8);
    valRead += getPaddedRepString(this.vmem[address+3], 2, 8);
    console.log(`(Mode: MSB -> LSB) MEM [INT-READ-EVENT] at address 0x${parseInt(address).toString(16)}: 4-byte Int (${parseInt(valRead, 2).toString(10)})`)
    return parseInt(parseInt(valRead, 2).toString(10))
  }

  // Write an integer
  writeInt(address, intVal) {
    let parsed = parseInt(intVal).toString(2);
    let origVal = parsed.length
    // Pad with zeros if less than 32 bits
    if (origVal < 32) {
      let zeros="";
      for(let i = 0; i < 32 - origVal; i++) {
        zeros += "0"
      }
      parsed = zeros + parsed
    } else if (origVal > 32) {
      parsed = parsed.substr(parsed.length - 32, parsed.length)
    }
    console.log(`(Mode: MSB -> LSB) MEM [INT-WRITE-EVENT] at address 0x${parseInt(address).toString(16)}: 4-byte Int (${parseInt(intVal).toString(10)})`)

    for (let i = 0; i < 4; i++) {
      this.vmem[address + i] = parseInt(parsed.substr(0 + 8*i, 8), 2);
    }
  }

  reserve(start, size) {
    for (let i = start; i < start + size; i++) {
      this.vmem[i] = 0;
    }
    return { startAddr: start, endAddr: start + size};
  }
  

  dumpMemory() {
    console.log(`Memory Dump:`);

    for (let i = this.start; i < this.size_in_bytes; i+=8) {
      console.log(`at address 0x${parseInt(i).toString(16)}: ${getPaddedRepString(this.vmem[i], 16, 2)} ${getPaddedRepString(this.vmem[i+1], 16, 2)} ${getPaddedRepString(this.vmem[i+2], 16, 2)} ${getPaddedRepString(this.vmem[i+3], 16, 2)} ${getPaddedRepString(this.vmem[i+4], 16, 2)} ${getPaddedRepString(this.vmem[i+5], 16, 2)} ${getPaddedRepString(this.vmem[i+6], 16, 2)} ${getPaddedRepString(this.vmem[i+7], 16, 2)}`, )
    }
  }
}

let mainMem = new Memory(256)

// mainMem.writeInt(0, 256)
// mainMem.dumpMemory()

// mainMem.readInt(1)


let memoryManager = mainMem.start;
export class MMatrix {
  constructor(row, col) {
    this.row = row;
    this.col = col;
    let res = mainMem.reserve(memoryManager, row*col*4);
    memoryManager = res.endAddr;
    this.startIdx = res.startAddr;
  }

  set(i, j, val) {
    let addr = this.startIdx + (this.col*i + j) * 4;
    mainMem.writeInt(addr, val);
  }

  get(i, j) {
    let addr = this.startIdx + (this.col*i + j) * 4;
    return mainMem.readInt(addr)
  }
}

let A = new MMatrix(2,2);
A.set(0,0,1)
A.set(0,1,2)
A.set(1,0,3)
A.set(1,1,4)

let B = new MMatrix(2,2);
B.set(0,0,1)
B.set(0,1,2)
B.set(1,0,3)
B.set(1,1,4)

function multiply(mat1, mat2, res)  {
  let i, j, k;
  for (i = 0; i < 2; i++) {
    for (j = 0; j < 2; j++) {
      res.set(i,j,0);
      for (k = 0; k < 2; k++) {
        res.set(i,j, res.get(i,j) + mat1.get(i,k) * mat2.get(k,j));
      }
    }
  }
}
let C = new MMatrix(2,2);
multiply(A, B, C)

mainMem.dumpMemory()
