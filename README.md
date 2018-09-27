# wTextRank

Implementation of TextRank algorithm on text parsed by the Google API. The main function is `rankSentences()`, which takes as arguments the text data and an optional weighting function on tokens (i.e., on words). The default weighting function assigns 1 to each token.

## Example

Here's an example app in Node:

```const WTextRank = require('./wTextRank');
const fs = require('fs');

fs.readFile( __dirname + '/parsedText.txt', (err, data) => {
  if (err) {
    throw err;
  }
  textData = JSON.parse(data);

  const WTR = new WTextRank(textData);
  let rankedSentences = WTR.rankSentences();

  let bestSentences = rankedSentences.slice(0, 5);
  let worstSentences = rankedSentences.slice(-5);

  console.log(bestSentences.map(s => [+s.score.toFixed(2), s.text.content, Array.from(s.keyTokens)]));
  console.log();
  console.log(worstSentences.map(s => [+s.score.toFixed(2), s.text.content, Array.from(s.keyTokens)]));
});
```