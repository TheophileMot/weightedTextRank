# wTextRank

Implementation of TextRank algorithm on text parsed by the Google API. The main function is `rankSentences()`, which takes as arguments the text data and an optional weighting function on tokens. The default weighting function assigns 1 to each token.

## Usage

```
let WTextRank(textData, tokenWeightFunction);
let rankedSentences = WTR.rankSentences();
```

Arguments: `textData` is provided by the Google API, and `tokenWeightFunction` is of the following form:

```
tokenWeightFunction(tokenIndex, sentence) {
  ... 
  return weight
}
```
where `sentence` is an object with keys `text`, `tokens`, `keyTokens`. The `weight` should be strictly positive. See the code for more details.

The weight of each sentence is the product of the weights of its tokens.

## Example

Here's an example app in Node; it penalizes sentences with pronouns.

```
const WTextRank = require('./wTextRank');
const fs = require('fs');

fs.readFile( __dirname + '/parsedText.txt', (err, data) => {
  if (err) {
    throw err;
  }
  textData = JSON.parse(data);

  function tokenWeightFunction(i, data) {
    if (data.tokens[i].partOfSpeech.tag === 'PRON') {
      return 0.1;
    } else {
      return 1;
    }
  }
  const WTR = new WTextRank(textData);
  let rankedSentences = WTR.rankSentences();

  let bestSentences = rankedSentences.slice(0, 5);
  let worstSentences = rankedSentences.slice(-5);

  console.log(bestSentences.map(s => [+s.score.toFixed(2), s.text.content, Array.from(s.keyTokens)]));
  console.log();
  console.log(worstSentences.map(s => [+s.score.toFixed(2), s.text.content, Array.from(s.keyTokens)]));
});
```