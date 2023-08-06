'use client';

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Col, Container, Form, InputGroup, Navbar, Row } from "react-bootstrap";
import Editor from "react-simple-code-editor";
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/themes/prism.css'; //Example style, you can use another


let default_code = `
async function execute() {
  let A = new MMatrix(2,2);
  await A.allocateMemory()
  await A.set(0,0,1)
  await A.set(0,1,2)
  await A.set(1,0,3)
  await A.set(1,1,4)

  let B = new MMatrix(2,2);
  await B.allocateMemory()
  await B.set(0,0,1)
  await B.set(0,1,2)
  await B.set(1,0,3)
  await B.set(1,1,4)

  async function multiply(mat1, mat2, res)  {
    let i, j, k;
    for (i = 0; i < 2; i++) {
      for (j = 0; j < 2; j++) {
        await res.set(i,j,0);
        for (k = 0; k < 2; k++) {
          let a = await mat1.get(i,k);
          let b = await mat2.get(k,j);
          let c = await res.get(i,j);
          await res.set(i,j, c + a * b);
        }
      }
    }
  }

  let C = new MMatrix(2,2);
  await C.allocateMemory()
  await multiply(A, B, C)
} 

async function test() {
  await memHierarchyWrite(0x0,10);
  await memHierarchyWrite(0x1,10);
  await memHierarchyWrite(0x2,10);
  
  await memHierarchyRead(0x1,10);

}

test()
`

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



const MemUIAddr = (props) => {
  return <div style={{ textAlign: 'center', display: 'inline-block', borderColor: '#afafaf', borderStyle: 'dotted', borderWidth: 1, width: 70, paddingTop: 5, paddingBottom: 5, color: '#a0a0a0', fontWeight: 'bold' }}>
    {props.addr}
  </div>
}

const MemUIByte = (props) => {
  const highlighted = props.highlighted
  const highlightread =props.highlightedRead
  const highlightedOther = props.highlightedOther
  return <div style={{ 
    display: 'inline-block', 
    paddingTop: 5, 
    paddingBottom: 5, 
    marginLeft: 5, 
    borderColor: '#afafaf', 
    borderStyle: 'dotted', 
    borderWidth: 1, 
    color: highlighted ? "red" : highlightread ? 'green' : highlightedOther ? "orange" : '#afafaf', 
    fontFamily: 'monospace',
    fontWeight: highlighted ? "bold" : undefined, 
    }}>
    {props.val}
  </div>
}

const CacheElement = (props) => {
  const {indexBits, index, tag, value, bits} = props
  return <div>
    <MemUIAddr addr={getPaddedRepString(index, 2, indexBits)}/>
    <MemUIByte 
      highlightedRead={addressesToHighlightRead.includes(parseInt(j.address))} 
      highlighted={addressesToHighlight.includes(parseInt(j.address))} 
      highlightedOther={addressesToHighlightOther.includes(parseInt(j.address))}
      val={`${getPaddedRepString(j.value, memoryBase < 2 ? 2 : memoryBase > 36 ? 16 : memoryBase, memoryBase < 2 ? 8 : memoryBase > 36 ? 2 : getBaseMod(memoryBase))}`}/>
  </div>
}




function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}



export default () => {
  const [mainMemory, setMainMemory] = useState(undefined);
  const [cacheMemory, setCacheMemory] = useState([]);
  const [memSize, setMemSize] = useState(8192);
  const [code, setCode] = useState(default_code);
  const [addressesToHighlightOther, setAddressesToHighligtOther] = useState([]);
  const [addressesToHighlightRead, setAddressesToHighligtRead] = useState([]);
  const [addressesToHighlight, setAddressesToHighligt] = useState([]);
  const [bytesPerLine, setBytesPerLine] = useState(16);
  const [memoryAccessPause, setMemoryAccessPause] = useState(14);
  const [memoryBase, setMemoryBase] = useState(16);

  const [memReads, setMemReads] = useState(0);
  const [memReadCycles, setMemReadCycles] = useState(0);
  const [memWrites, setMemWrites] = useState(0);
  const [memWritesCycles, setMemWritesCycles] = useState(0);

  const [memHierarchy, setMemHierarchy] = useState([]);

  const [cacheSize, setCacheSize] = useState(128);
  const [lineSize, setLineSize] = useState(16);

  const getIterableBytes = (ele) => {
    let res = []
    for(let i = 0; i < ele.length; i+=8) {
      console.log("subb", ele.substring(i, i+8))
      res.push(ele.substring(i, i+8))
    }
    console.log("iterable bytes", ele, res)
    return res
  }

  const getBaseMod = () => {
    switch(memoryBase) {
      case 16: return 2
      case 10: return 3
      case 2: return 8
    }
    return 0
  }

  const memoryAccessPauseRef = useRef();

  useEffect(() => {
    memoryAccessPauseRef.current = memoryAccessPause;
  });


  let memoryManager = 0;

  const getSleepSteps = () => {
    return memoryAccessPauseRef.current;
  }

  const getSleepStepSize = () => {
    return 1;
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
    async readInt(address)  {
      let valRead = ""
      valRead += getPaddedRepString(this.vmem[address], 2, 8);
      valRead += getPaddedRepString(this.vmem[address+1], 2, 8);
      valRead += getPaddedRepString(this.vmem[address+2], 2, 8);
      valRead += getPaddedRepString(this.vmem[address+3], 2, 8);
      console.log(`(Mode: MSB -> LSB) MEM [INT-READ-EVENT] at address 0x${parseInt(address).toString(16)}: 4-byte Int (${parseInt(valRead, 2).toString(10)})`)

      let atH = []
      atH.push(address)
      atH.push(address+1)
      atH.push(address+2)
      atH.push(address+3)

      setMemReads((old) => ++old)
      setMemReadCycles((old) => old + 200)

      await setAddressesToHighligtRead(atH);
      for (let i = 0; i < getSleepSteps(); i++) {
        await sleep(i * getSleepStepSize());
      }
      await setAddressesToHighligtRead([]);

      return parseInt(parseInt(valRead, 2).toString(10))
    }
  
    // Write an integer
    async writeInt(address, intVal) {
      let parsed = parseInt(intVal).toString(2);
      let origVal = parsed.length

      let atH = []

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
        atH.push(address + i)
        this.vmem[address + i] = parseInt(parsed.substr(0 + 8*i, 8), 2);
      }

      setMemWrites((old) => ++old)
      setMemWritesCycles((old) => old + 200)
      
      
      await setMainMemory({ timestamp: new Date(), memory: this});
      await setAddressesToHighligt(atH);
      for (let i = 0; i < getSleepSteps(); i++) {
        await sleep(i * getSleepStepSize());
      }
      setAddressesToHighligt([]);
    }


    async readLine(address) {
      console.log("readLine", address, (address % lineSize), (address % lineSize) * lineSize)
      address = (Math.floor(address / lineSize)) * lineSize

      let valRead = ""
      let atH = []
      for (let i = 0; i < lineSize; i++) {
        atH.push(address+i)
        valRead += getPaddedRepString(this.vmem[address + i], 2, 8);
      }
      console.log(`(Mode: MSB -> LSB) MEM [INT-READ-LINE-EVENT] at address 0x${parseInt(address).toString(16)}: ${lineSize}-byte Data (${valRead}`)
      setMemReads((old) => ++old)
      setMemReadCycles((old) => old + 200 * lineSize)
      await setAddressesToHighligtOther(atH);
      for (let i = 0; i < getSleepSteps() ; i++) {
        await sleep(i * getSleepStepSize() * 1.5);
      }
      await setAddressesToHighligtOther([]);
      return valRead;
    }
  
    writeLine(address, data) {
      // let valRead = ""
      // for (let i = 0; i < lineSize; i++) {
      //   valRead += getPaddedRepString(this.vmem[address + i], 2, 8);
      // }
      // console.log(`(Mode: MSB -> LSB) MEM [INT-READ-LINE-EVENT] at address 0x${parseInt(address).toString(16)}: ${lineSize}-byte Data (0x${parseInt(valRead, 2).toString(16)})`)
    }
  

    async reserve(start, size) {
      let atH = []
      for (let i = start; i < start + size; i++) {
        atH.push(i);
        this.vmem[i] = 0;
      }
      await setMainMemory({ timestamp: new Date(), memory: this});
      await setAddressesToHighligt(atH);
      for (let i = 0; i < getSleepSteps(); i++) {
        await sleep(i * getSleepStepSize());
      }
      
      return { startAddr: start, endAddr: start + size};
    }
    
  
    dumpMemory() {
      console.log(`Memory Dump:`);
  
      for (let i = this.start; i < this.size_in_bytes; i+=8) {
        console.log(`at address 0x${parseInt(i).toString(16)}: ${getPaddedRepString(this.vmem[i], 16, 2)} ${getPaddedRepString(this.vmem[i+1], 16, 2)} ${getPaddedRepString(this.vmem[i+2], 16, 2)} ${getPaddedRepString(this.vmem[i+3], 16, 2)} ${getPaddedRepString(this.vmem[i+4], 16, 2)} ${getPaddedRepString(this.vmem[i+5], 16, 2)} ${getPaddedRepString(this.vmem[i+6], 16, 2)} ${getPaddedRepString(this.vmem[i+7], 16, 2)}`, )
      }
    }
    getJSONData(words_per_line=8) {
      let res = [];
  
      for (let i = this.start; i < this.size_in_bytes; i+=words_per_line) {
        let r1 = []
        for (let j = 0; j < words_per_line; j++) {
          r1.push({ address: i + j, value: this.vmem[i + j] })
        }
        res.push(r1)
      }
      return res
    }
  }

  class DirectlyMappedCache {
    constructor(cacheSize) {
      this.size = cacheSize
      this.offsetBits = Math.floor(Math.log2(lineSize));
      this.indexBits = Math.floor(Math.log2(cacheSize/lineSize));
      this.store = new Array(2**this.indexBits)

      for (let i = 0; i < this.store.length; i++) {
        this.store[i] = { tag: undefined, data: "EMPTY" }
      }
    }

    async contains(address) {
      const addressInBinary = getPaddedRepString(address, 2, 16);
      let tag = addressInBinary.substring(0, addressInBinary.length - this.offsetBits - this.indexBits);
      const indexBits = addressInBinary.substring(addressInBinary.length - this.offsetBits - this.indexBits, addressInBinary.length - this.offsetBits)
      const lookupIndex = parseInt(indexBits, 2)
      if (this.store[lookupIndex].tag === tag) {
        console.log("Cache Hit")
        return true;
      } else {
        console.log("Cache Miss, tag match failed")
        return false;
      }
    }

    async remove(address) {
      const addressInBinary = getPaddedRepString(address, 2, 16);
      let tag = addressInBinary.substring(0, addressInBinary.length - this.offsetBits - this.indexBits);
      const indexBits = addressInBinary.substring(addressInBinary.length - this.offsetBits - this.indexBits, addressInBinary.length - this.offsetBits)
      const lookupIndex = parseInt(indexBits, 2)
      this.store[lookupIndex].tag = undefined;
    }

    async getLine(address) {
      const addressInBinary = getPaddedRepString(address, 2, 16);
      let tag = addressInBinary.substring(0, addressInBinary.length - this.offsetBits - this.indexBits);
      const indexBits = addressInBinary.substring(addressInBinary.length - this.offsetBits - this.indexBits, addressInBinary.length - this.offsetBits)
      const lookupIndex = parseInt(indexBits, 2)
      if (this.store[lookupIndex].tag === tag) {
        return this.store[lookupIndex].data;
      } else {
        console.error("Invalid Cache Line Read")
        return "SEGFAULT";
      }
    }

    async addLine(address, lineData) {
      console.log("addLine", address, lineData)
      const addressInBinary = getPaddedRepString(address, 2, 16);
      let tag = addressInBinary.substring(0, addressInBinary.length - this.offsetBits - this.indexBits);
      const indexBits = addressInBinary.substring(addressInBinary.length - this.offsetBits - this.indexBits, addressInBinary.length - this.offsetBits)
      const lookupIndex = parseInt(indexBits, 2);
      this.store[lookupIndex].tag = tag;
      this.store[lookupIndex].data = lineData;
      console.log("addLine End", lookupIndex, tag, lineData)
    }

    async getOffset(address) {
      const addressInBinary = getPaddedRepString(address, 2, 16);
      let offsetBits = addressInBinary.substring(addressInBinary.length - this.offsetBits, addressInBinary.length);
      return parseInt(offsetBits, 2)
    }

    printData() {
      console.log("DMC: ", this.store);
    }
    

  }

  const createADirectlyMappedCache = () => {
    setMemHierarchy((old) => [...old, { timestamp: new Date(), memory: new DirectlyMappedCache(cacheSize)}] )
  }

  const memHierarchyRead = async (address) => {
    if (memHierarchy.length > 0) {
      for (let i = 0; i < memHierarchy.length; i++) {
        let mem = memHierarchy[i].memory
        if (mem.constructor.name === "DirectlyMappedCache") {
          let cacheHit = await mem.contains(address);
          if (!cacheHit) {
            let res = await mainMemory.memory.readLine(address)
            await mem.addLine(address, res)
          }
          let currLine = await mem.getLine(address)
          let offset = await mem.getOffset(address)
          currLine = currLine.substring(offset*8,currLine.length)
          let data = currLine.substring(0, 32)
          return parseInt(data, 2)
        }
      }
    }
    let res = await mainMemory.memory.readInt(address)
    return res
  }

  const memHierarchyWrite = async (address, value) => {
    if (memHierarchy.length > 0) {
      for (let i = 0; i < memHierarchy.length; i++) {
        let mem = memHierarchy[i].memory
        if (mem.constructor.name === "DirectlyMappedCache") {
          let cacheHit = await mem.contains(address);
          // Invalidate the cache if we are writing to an address that is contained in the cache
          if (cacheHit) {
            await mem.remove(address)
          }
        }
      }
    }
    return (await mainMemory.memory.writeInt(address, value))
  }

  class MMatrix {
    constructor(row, col) {
      this.row = row;
      this.col = col;
    }

    async allocateMemory() {
      let res = await mainMemory.memory.reserve(memoryManager, this.row*this.col*4);
      memoryManager = res.endAddr;
      this.startIdx = res.startAddr;
    }
  
    async set(i, j, val) {
      let addr = this.startIdx + (this.col*i + j) * 4;
      await memHierarchyWrite(addr, val);
    }
  
    async get(i, j) {
      let addr = this.startIdx + (this.col*i + j) * 4;
      let res = await memHierarchyRead(addr)
      return res
    }
  }
	
	const handleEval = async () => {
		await eval(code)
	}

  const setMem = () => {
    setMainMemory({ timestamp: new Date(), memory: new Memory(memSize)});
  }


	return (
    <>
      <Navbar expand="lg" className="bg-body-tertiary">
        <Container>
          <Navbar.Brand href="#home">Meetesh's mem sim</Navbar.Brand>
        </Container>
      </Navbar>
      <Container style={{ paddingTop: 25 }}>
        {/* Stack the columns on mobile by making one full-width and the other half-width */}
        <Row>
          <Col xs={12} md={7}>
            {
              memHierarchy.length <= 0 && <Alert variant="info" >
                <h5>
                  Add a Directly Mapped Cache (optional)
                </h5>
                <hr/>
                <InputGroup hasValidation>
                  <Form.Control
                    type="number"
                    onChange={(e) => {
                      if (e.target.value === "") return;
                      console.log(e.target.value)
                      setCacheSize(parseInt(e.target.value) !== NaN ? parseInt(e.target.value) : 128)
                    }}
                    value={cacheSize}
                  />
                  <InputGroup.Text id="inputGroupPrepend">Cache Size (Bytes)</InputGroup.Text>
                  <Button disabled={memSize === ""} onClick={createADirectlyMappedCache} variant="success">Add</Button>
                </InputGroup>

                <hr/>
                <b>Index Bits: </b> { Math.floor(Math.log2(cacheSize/lineSize))}
                <br/>
                <b>Offset Bits: </b> { Math.floor(Math.log2(lineSize))}
              </Alert>
            }
            {
              !mainMemory && <Alert variant="danger" >
                <h5>
                  Memory (Needed, duh!)
                </h5>
                This simulates a system with fixed memory and displays the operations and other statistics performed on it. <br/>
                <b>Note 1:</b> Word size is fixed to 4-Bytes. <br/>
                <b>Note 2:</b> Each read/write is 200 cycles. <br/>

                <hr/>
                <InputGroup hasValidation>
                  <Form.Control
                    type="number"
                    onChange={(e) => {
                      if (e.target.value === "") return;
                      console.log(e.target.value)
                      setMemSize(parseInt(e.target.value) !== NaN ? parseInt(e.target.value) : 128)
                    }}
                    value={memSize}
                  />
                  <InputGroup.Text id="inputGroupPrepend">Memory (Bytes)</InputGroup.Text>

                  <Form.Control
                    type="number"
                    onChange={(e) => {
                      if (e.target.value === "") return;
                      console.log(e.target.value)
                      setLineSize(parseInt(e.target.value) !== NaN ? parseInt(e.target.value) : 16)
                    }}
                    value={lineSize}
                  />
                  <InputGroup.Text id="inputGroupPrepend">Line Size (Bytes)</InputGroup.Text>

                  <Button disabled={memSize === ""} onClick={setMem} variant="success">Set</Button>
                </InputGroup>
              </Alert>
            }
            {
              memHierarchy.map((v, idx) => {
                v = v.memory
                if (v.constructor.name === "DirectlyMappedCache") {
                  return <Card>
                    <Card.Header>L{idx+1} Directly Mapped Cache ({v.size} Bytes)</Card.Header>
                    <Card.Body>
                      {v.store.map((ele, index) => {
                        // console.log("eleLog, ", ele)
                        return <div>
                            <MemUIAddr addr={getPaddedRepString(index, 2, v.indexBits)}/>
                              
                              <div
                                style={{ 
                                    display: 'inline-block',
                                  }}
                              >
                                <div 
                                  style={{ 
                                    display: 'inline-block',
                                    // borderStyle: 'dasshed'
                                  }}
                                  >
                                    {
                                      ele.tag === undefined && <span>{"EMPTY-TAG"}</span>
                                    }
                                    {
                                      ele.tag !== undefined &&  <span>{ele.tag}</span>
                                    }
                                </div>
                                <div 
                                  style={{ 
                                    display: 'inline-block',
                                  }}
                                  >
                                    {
                                      getIterableBytes(ele.data).map((e) => {
                                        return <MemUIByte 
                                        highlightedRead={addressesToHighlightRead.includes(parseInt(100))} 
                                        highlighted={addressesToHighlight.includes(parseInt(100))} 
                                        highlightedOther={addressesToHighlightOther.includes(parseInt(100))}
                                        val={`${getPaddedRepString(parseInt(e, 2),16,2)}`}/>
                                      })
                                    }
                                </div>
                              </div>
                          </div>
                      })}
                    </Card.Body>
                    <Card.Footer>
                      <Button onClick={() => {setMemHierarchy(old => old.filter((val,iii) => iii != idx)); }}>Remove</Button>
                    </Card.Footer>
                  </Card>
                } else {
                  return <div>Under Dev</div> 
                }
              })
            }
            <hr/>
            {
              mainMemory && <div>
                <Card>
                  <Card.Header>
                    <h5>
                      System Memory
                    </h5>
                    <InputGroup hasValidation>
                      <Form.Control
                        onChange={(e) => {
                          if (e.target.value === "") return;
                          console.log(e.target.value)
                          setBytesPerLine(parseInt(e.target.value) !== NaN ? parseInt(e.target.value) : 8)
                        }}
                        value={bytesPerLine}
                      />
                      <InputGroup.Text id="inputGroupPrepend">Bytes to display per line</InputGroup.Text>
                      <Form.Control
                        onChange={(e) => {
                          if (e.target.value === "") return;
                          console.log(e.target.value)
                          setMemoryAccessPause(parseInt(e.target.value) !== NaN ? parseInt(e.target.value) : 30)
                        }}
                        value={memoryAccessPause}
                      />
                    </InputGroup>
                    <InputGroup.Text id="inputGroupPrepend">Highlight Pause Time (30 =~ 1sec)</InputGroup.Text>
                      <Form.Control
                        onChange={(e) => {
                          if (e.target.value === "") return;
                          console.log(e.target.value)
                          setMemoryBase(parseInt(e.target.value) !== NaN ? parseInt(e.target.value) : 16)
                        }}
                        value={memoryBase}
                      />
                      <InputGroup.Text id="inputGroupPrepend">Base (16 = HEX)</InputGroup.Text>

                  </Card.Header>
                  <Card.Body style={{ maxHeight: '40vh', overflow: 'scroll' }}>
                    {
                      mainMemory.memory.getJSONData(bytesPerLine).map((v) => {
                        return (<div>
                          <MemUIAddr addr={`0x${parseInt(v[0].address).toString(16)}`}/>
                          {
                            v.map((j)=> {
                              return <MemUIByte 
                                highlightedRead={addressesToHighlightRead.includes(parseInt(j.address))} 
                                highlighted={addressesToHighlight.includes(parseInt(j.address))} 
                                highlightedOther={addressesToHighlightOther.includes(parseInt(j.address))}
                                val={`${getPaddedRepString(j.value, memoryBase < 2 ? 2 : memoryBase > 36 ? 16 : memoryBase, memoryBase < 2 ? 8 : memoryBase > 36 ? 2 : getBaseMod(memoryBase))}`}/>
                            })
                          }
                          </div>
                          )
                      })
                    }
                  </Card.Body>
                  <Card.Footer>
                    <h6>
                      Statistics:
                    </h6>
                    <b>Reads:</b> {memReads} &nbsp;&nbsp;&nbsp;&nbsp; <b>Writes:</b> {memWrites}  <br></br>
                    <b>Clock Cycles:</b> {memReadCycles} &nbsp;&nbsp;&nbsp;&nbsp; <b>Clock Cycles:</b> {memWritesCycles} <br></br>
                  </Card.Footer>
                </Card>
              </div> 
            }
          </Col>
          <Col xs={12} md={5}>
            <Card>
              <Card.Header>
                Code Area
              </Card.Header>
              <Card.Body>
                
                <Editor
                  value={code}
                  onValueChange={code => setCode(code)}
                  highlight={code => highlight(code, languages.js)}
                  padding={0}
                  style={{
                    fontFamily: '"Fira code", "Fira Mono", monospace',
                    fontSize: 11,
                  }}
                />
              </Card.Body>
              <Card.Footer>
                <Button onClick={handleEval} variant="outline-primary" >Execute</Button>
              </Card.Footer>
            </Card>
          </Col>
        </Row>

      </Container>
    </>
	)
}