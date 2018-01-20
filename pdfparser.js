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

        const getData = (data, secondSection) => {
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
                // Edge cases...
                if (row.length === 15) {
                    if (secondSection) {
                        row.splice(11, 0, "0"); // Add Piece Count if missing.
                        row.splice(13, 0, "0"); // Add ECP attach if missing.
                    } else {
                        row.splice(8, 0, "0"); // Add Piece Count if missing.
                        row.splice(12, 0, "0"); // Add ECP attach if missing.
                    }
                } else if (row.length === 16) {
                    if (secondSection) {
                        row.splice(13, 0, "0"); // Add ECP attach if missing.
                    } else {
                        row.splice(12, 0, "0"); // Add ECP attach if missing.
                    }
                }
                return row
            })
        }

        const getPageData = (pages, secondSection) => {
            let pageData = []
            let sectionStarted = false
            pages.every((page) => {
                let pageToken = page['Fills'].some(f => f['oc'] === '#5b5b87') // A first page in a section will contain a '#5b5b87' fill
                if (pageToken) {
                    if (sectionStarted) {
                        // We already processed the start of this section
                        return false
                    } else {
                        // This is the start of the section. Mark it for next time.
                        sectionStarted = true
                        // Add the data
                        pageData = pageData.concat(getData(page['Texts'], secondSection))
                    }
                } else {
                    if (sectionStarted) {
                        // This is a multi-page section, only add the data if the section was previously started
                        pageData = pageData.concat(getData(page['Texts'], secondSection))
                    }
                }
                return true
            })
            return pageData
        }

        const getRank = function (result, data, index) {
            let sorted = data.sort((a, b) => b[index] - a[index])
            let rank = 0
            while (rank < sorted.length && sorted[index] !== result) {
                rank++
            }
            return rank + 1
        }

        pdfParser.on("pdfParser_dataError", errData => reject(errData.parserError) );
        pdfParser.on("pdfParser_dataReady", pdfData => {
            try {
                // Since results in a section can bleed to multiple pages, we need to get creative. Fortunately, each section is bookended by titles over a purple fill.
                // We'll be using that to detect and collect all the data on a section.
                let page = getPageData(pdfData['formImage']['Pages'], false) // "Section 1" contains all the juicy week-to-date stuff
                let table = page.map((row, i) => {
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
                        CleanUp.float(row[16]) // POD Attach % (12)
                    ]
                    let salesRank = getRank(row[2], page, 6)
                    let atvRank = getRank(row[3], page, 7)
                    let pieceCountRank = getRank(row[4], page, 8)
                    let techRank = getRank(row[4], page, 8)
                    let ecpRank = getRank(row[7], page, 11)
                    let classRank = getRank(row[9], page, 13)
                    let emailRank = getRank(row[11], page, 15)
                    let podRank = getRank(row[12], page, 16)
                    row = row.concat([
                        salesRank, // 13
                        atvRank, // 14
                        pieceCountRank, // 15
                        techRank, // 16
                        ecpRank, // 17
                        classRank, // 18
                        emailRank, // 19
                        podRank, // 20
                        (salesRank + atvRank + pieceCountRank + techRank + ecpRank + classRank + emailRank + podRank) / 8 // Overall Rank (21)
                    ])
                    return row;
                });
                resolve(table);
            } catch (err) {
                console.error(err);
                reject(err);
            }
        });

        pdfParser.parseBuffer(pdfBuffer);
    })
}

module.exports = parsePDF;