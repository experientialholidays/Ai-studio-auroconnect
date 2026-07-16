const marked = require('marked');
const md = `<span style="display: flex;"><span>type</span><span>date</span></span>\n**[Title](#DETAILS::123)**\n⏰ time | 📍 loc`;
console.log(marked.parse(md, {breaks: true}));
