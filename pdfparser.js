const PDFParser = require("pdf2json");

const CleanUp = {
    name: (s) => {
        s = s.split(', ');
        return {firstname: s[1], lastname: s[0]};
    },
    float: (s) => {
        let negative = false;
        if (s.indexOf('(') > -1 || s.indexOf('-') > -1) {negative = true};
        s = s.replace(/[^\d,\.]/g, '');
        s = s.replace(',', '.');
        s = parseFloat(s);
        if (negative) {
            return -s;
        } else {
            return s;
        }
    }
}

const parsePDF = function (pdfBuffer) {
    return new Promise((resolve, reject) => {
        let pdfParser = new PDFParser();

        let getData = (data) => {
            let rows = {}
            // Every string in a table row will have the same 'y' value. We use that to build a dictionary of rows
            data.forEach((o) => {
                if (!(String(o.y) in rows)) {
                    rows[String(o.y)] = [];
                }
                rows[String(o.y)].push(decodeURIComponent(o.R[0].T).trim());
            });
            // Then we rebuild our table from the dictionary
            return Object.keys(rows).filter((o) => {
                return (rows[o].length > 10 && rows[o][3] === 'Active'); // Filter out titles and inactive associates
            }).sort((a,b) => {return parseFloat(a) - parseFloat(b)}).map((o) => {
                let row = rows[o];
                if (row.length === 16) {
                    row.splice(12, 0, "0"); // Add ECP attach if missing.
                }
                return row
            })
        }

        pdfParser.on("pdfParser_dataError", errData => reject(errData.parserError) );
        pdfParser.on("pdfParser_dataReady", pdfData => {
            let page1 = getData(pdfData['formImage']['Pages'][0]['Texts']) // Page 1 contains all the juicy week-to-date stuff
            let page2 = getData(pdfData['formImage']['Pages'][1]['Texts']) // Page 2 contains all rankings
            let table = page1.map((row, i) => {
                // Now we keep only the columns we want and clean them up.
                row = [
                    row[1], // Associate Number (0)
                    CleanUp.name(row[2]), // Associate Name {firstname, lastname} (1)
                    CleanUp.float(row[6]), // Sales $ (2)
                    CleanUp.float(row[7]), // ATV $ (3)
                    CleanUp.float(row[8]), // Piece Count (4)
                    CleanUp.float(row[9]), // Transaction Count (5)
                    CleanUp.float(row[10]), // Tech Sales $ (6)
                    CleanUp.float(row[11]), // ECP Qty (7)
                    CleanUp.float(row[12]), // ECP Attach % (8)
                    CleanUp.float(row[13]), // Class Attach (9)
                    CleanUp.float(row[14]), // Airmiles Attach % (10)
                    CleanUp.float(row[15]), // Email Attach % (11)
                    CleanUp.float(row[16]), // POD Attach % (12)
                    CleanUp.float(page2[i][6]), // Overall Rank (13)
                    CleanUp.float(page2[i][8]), // Sales Rank (14)
                    CleanUp.float(page2[i][10]), // ATV Rank (15)
                    CleanUp.float(page2[i][12]), // Piece Count Rank (16)
                    CleanUp.float(page2[i][14]), // ECP Rank (17)
                    CleanUp.float(page2[i][16]) // Class Attach Rank (18)
                ]
                return row;
            });
            resolve(table);
        });

        pdfParser.parseBuffer(pdfBuffer);
    })
}

module.exports = parsePDF;