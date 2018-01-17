const request = require('request')
const fs = require('fs')

fs.readFile('test.pdf', (err, file) => {
    let buf = Buffer.from(file, 'base64')
    request.post('http://localhost:9090/loaddata', {body: {storeno: '139', data: buf}, json: true}, (err, res) => {
        if (err) {console.error(err)}
        console.log(res)
    })
})