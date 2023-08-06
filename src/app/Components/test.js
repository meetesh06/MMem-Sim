// writeInt = (address, intVal) => {
//   parsed = parseInt(intVal).toString(2);
//   origVal = parsed.length
//   // Pad with zeros if less than 32 bits
//   if (origVal < 32) {
//     zeros="";
//     for(i = 0; i < 32 - origVal; i++) {
//       zeros += "0"
//     }
//     parsed = zeros + parsed
//   } else if (origVal > 32) {
//     parsed = parsed.substr(parsed.length - 32, parsed.length)
//   }
//   console.log(`(Mode: MSB -> LSB) MEM [INT-WRITE-EVENT] at address 0x${parseInt(address).toString(16)}: 8byte Int (${parseInt(intVal).toString(10)})`)

  
//   // this.vmem[address]
//   console.log(parsed, parsed.length);
//   console.log(parsed.substr(0, 8))
//   console.log(parsed.substr(8, 8))
//   console.log(parsed.substr(16, 8))
//   console.log(parsed.substr(24, 8))
// }

// writeInt(0x1000, 1021554)

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


let a = getPaddedRepString(1, 2, 8)
console.log(a)