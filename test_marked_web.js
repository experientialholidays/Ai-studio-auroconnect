const fs = require('fs');
const https = require('https');
https.get('https://cdn.jsdelivr.net/npm/marked/marked.min.js', (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        fs.writeFileSync('marked.min.js', data);
        console.log('Downloaded marked');
    });
});
