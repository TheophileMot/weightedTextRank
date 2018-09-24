const fs = require('fs');

function intersect(setA, setB) {
  let result = new Set;
  setA.forEach(x => {
    if (setB.has(x)) {
      result.add(x);
    }
  });
  return result;
}

// note: slow down processing (for display purposes only)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clearScreen() {
  console.log('\033c');
}

function displayGraph(graph, iter, error, sentences) {
  console.log('\033[1;1H');
  console.log(`iteration ${iter}                           `);
  console.log(`error     ${error}                          `);
  let displayData = [];
  for (let v = 0; v < graph.length; v++) {
    displayData[v] = graph[v];
  }

  displayData.sort((v, w) => w.score - v.score);
  for (let v = 0; v < 10; v++) {
    console.log(`${String(displayData[v].score).padEnd(30)} ${String(displayData[v].index).padEnd(4)} ${sentences[displayData[v].index].text.content.slice(0, 120).padEnd(120)}`);
  }
  console.log('...');
  for (let v = graph.length - 10; v < graph.length; v++) {
    console.log(`${String(displayData[v].score).padEnd(30)} ${String(displayData[v].index).padEnd(4)} ${sentences[displayData[v].index].text.content.slice(0, 120).padEnd(120)}`);
  }
  console.log('\n'.repeat(3));
  // console.log(displayData[0].edges);
}

function compressSentences(sentences, tokens) {
  const DESIRABLE_TOKEN_TAGS = ['NOUN', 'ADJ', 'NUM'];

  let sentencesIndex = 0;
  let startPos = 0;

  // create an array of sentences that have at least one useful token (i.e., NOUN, ADJ, or NUM); see spec below
  let meaningfulSentences = [];
  let meaningfulSentencesIndex = 0;

  for (let token of tokens) {
    let word = token.text.content;
    let sentence = sentences[sentencesIndex].text.content;
    let pos = sentence.indexOf(word, startPos);
    while (pos === -1) {
      startPos = 0;
      sentencesIndex++;
      if (meaningfulSentencesIndex < meaningfulSentences.length) {
        meaningfulSentencesIndex++;
      }
      if (sentencesIndex >= sentences.length) {
        throw (`Error in compressSentences: tokens don't match sentences. Stopped looking at "${word}".`);
      }
      let sentence = sentences[sentencesIndex].text.content;
      pos = sentence.indexOf(word, startPos);
    }
    startPos = pos + 1;

    if (DESIRABLE_TOKEN_TAGS.includes(token.partOfSpeech.tag)) {
      if (meaningfulSentencesIndex === meaningfulSentences.length) {
        meaningfulSentences[meaningfulSentencesIndex] = {
          index: sentencesIndex,
          sentenceLength: sentence.length,
          tokens: new Set,
        };
      }
      meaningfulSentences[meaningfulSentencesIndex].tokens.add(word.toLowerCase());
    }
  }
  return meaningfulSentences;
}

function makeGraph(sentences, tokens) {
  let graph = compressSentences(sentences, tokens);
  for (let v = 0; v < graph.length; v++) {
    graph[v].score = 1;
    graph[v].edges = [];
    totalWeight = 0;
    for (let w = 0; w < graph.length; w++) {
      if (v !== w) {
        let intersection = intersect(graph[v].tokens, graph[w].tokens);
        if (intersection.size > 0) {
          weight = intersection.size / (Math.log(graph[v].sentenceLength) + Math.log(graph[v].sentenceLength));
          totalWeight += weight;
          graph[v].edges.push({
            tail: w,
            weight,
            // TODO: account for weights of tokens, i.e., replace intersection.size with sum of individual weights
          });
        }
      }
    }
    // normalize outgoing edge weights
    for (let edge of graph[v].edges) {
      edge.weight /= totalWeight;
    }
  }

  return graph;
}

// TODO: remove async, sentences parameter, and sleep call; they're there for display only
async function scoreGraph(graph, sentences) {
  // 0 ≤ D ≤ 1 is the damping factor, a magic number from TextRank paper (following PageRank, q.v.)
  // usually set to 0.85. It controls how much score is transferred from each vertex at each iteration.
  const D = 0.85;
  const MAX_ITERATIONS = 1000;
  const ERROR_THRESHOLD = 0.001;

  // iterate until ∆score < threshold for each vertex
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let newScore = [];
    for (let v = 0; v < graph.length; v++) {
      let incomingScore = 0;
      for (let e = 0; e < graph[v].edges.length; e++) {
        let w = graph[v].edges[e].tail;
        // if (v === 0) { console.log(`neighbour ${w} has score ${graph[w].score}`); }
        incomingScore += graph[w].edges.filter(edge => edge.tail === v)[0].weight * graph[w].score;
      }
      // if (v === 0) { console.log(`incoming ${incomingScore}`); }
      newScore[v] = (1 - D) + D * incomingScore;
    }

    let worstError = -Infinity;
    for (let v = 0; v < graph.length; v++) {
      worstError = Math.max(worstError, Math.abs(newScore[v] - graph[v].score));
      graph[v].score = newScore[v];
    }
    
    displayGraph(graph, iter, worstError, sentences);
    await sleep(200);
  }
}

fs.readFile( __dirname + '/parsedText.txt', (err, data) => {
  if (err) {
    throw err;
  }
  textData = JSON.parse(data);

  clearScreen();
  let graph = makeGraph(textData.sentences, textData.tokens);
  scoreGraph(graph, textData.sentences);
});


// Data structure reference
//
// meaningfulSentences = [
//   {
//     index:          int    index in original sentences array
//     sentenceLength: int    length of original sentence: N.B. for now this is measured in characters, not words
//     tokens:         Set    set of good token words in lower case
//   }
// ]