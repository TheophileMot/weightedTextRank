const WTextRank = require('./wTextRank');
const fs = require('fs');

fs.readFile( __dirname + '/parsedText.txt', (err, data) => {
  if (err) {
    throw err;
  }
  textData = JSON.parse(data);

  const WTR = new WTextRank(textData);

  let rankedSentences = WTR.rankSentences();
  let topTen = rankedSentences.slice(0, 10);
  let worstTen = rankedSentences.slice(-10);
  console.log(topTen);
  console.log(worstTen);
});
