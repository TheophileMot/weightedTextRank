const WTextRank = require('./wTextRank');
const fs = require('fs');

fs.readFile( __dirname + '/parsedText.txt', (err, data) => {
  if (err) {
    throw err;
  }
  textData = JSON.parse(data);

  const WTR = new WTextRank(textData.sentences, textData.tokens);
  let topTen = WTR.rankSentences().slice(0, 10);
  let worstTen = WTR.rankSentences().slice(-10);
  console.log(topTen);
  console.log(worstTen);
});
