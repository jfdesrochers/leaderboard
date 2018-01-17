const express = require('express')
const bodyParser = require('body-parser')
const parsePDF = require('./pdfparser')
const app = express()
const fs = require('fs')
const path = require('path')

app.use('/img', express.static('img'))
app.use('/assets', express.static('assets'))
app.use(bodyParser.json({limit: '5mb'}))

app.get('/leaderboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'leaderboard.html'))
})

app.get('/sender', (req, res) => {
    res.sendFile(path.join(__dirname, 'sender.html'))
})

app.post('/loaddata', (req, res) => {
    if (!req.body.data || !req.body.storeno) {
        return res.status(400).json({'error': 'Missing Information'})
    }
    parsePDF(Buffer.from(req.body.data, 'base64')).then((table) => {
        table = {lastUpdate: new Date(), storeno: req.body.storeno, data: table}
        fs.writeFile(`datacache/${req.body.storeno}.json`, JSON.stringify(table), (err) => {
            if (err) {return res.status(500).json({'error': err.message})}
            return res.json(table)
        })
    }).catch((e) => {
        return res.status(500).json({'error': e.message})
    })
})

app.get('/getdata', (req, res) => {
    if (!req.query.storeno) {
        return res.status(400).json({'error': 'Missing Information'})
    }
    fs.readFile(`datacache/${req.query.storeno}.json`, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({'error': 'No data for specified store.'})
            }
            return res.status(500).json({'error': err.message})
        }
        if (data) {
            return res.json(JSON.parse(data))
        } else {
            return res.status(404).json({'error': 'No data for specified store.'})
        }
    })
})

console.log('Listening on port 9090. Ctrl+C to stop.')
app.listen(9090)