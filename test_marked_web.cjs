const marked = require('marked');
const md2 = `<span class="ec-topbar"><span class="ec-type">*type*</span><span class="ec-date">date</span></span>**[Title](#DETAILS::123)**\n⏰ time | 📍 loc`;
console.log("Without newline:", marked.parse(md2, {breaks: true}));
