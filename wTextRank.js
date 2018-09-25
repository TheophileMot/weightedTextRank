module.exports = function(sentences, tokens) {
  this.intersect = function(setA, setB) {
    let result = new Set;
    setA.forEach(x => {
      if (setB.has(x)) {
        result.add(x);
      }
    });
    return result;
  }

  // // slow down processing (for display purposes only)
  // sleep(ms) {
  //   return new Promise(resolve => setTimeout(resolve, ms));
  // }

  // clearScreen() {
  //   console.log('\033c');
  // }

  // displayGraph(graph, iter, error) {
  //   console.log('\033[1;1H');
  //   console.log(`iteration ${iter}                           `);
  //   console.log(`error     ${error}                          `);
  //   console.log();
  //   let displayData = [];
  //   for (let v = 0; v < graph.length; v++) {
  //     displayData[v] = graph[v];
  //   }

  //   displayData.sort((v, w) => w.score - v.score);
  //   let topScore = displayData[0].score;
  //   let bottomScore = displayData[displayData.length - 1].score;
  //   for (let v = 0; v < Math.min(20, graph.length); v++) {
  //     let relativeScore = (displayData[v].score - bottomScore) / (topScore - bottomScore);
  //     let hsv = [120 * relativeScore, 100, 100]
  //     console.log(`${chalk.hsv(hsv)(String(displayData[v].score).padEnd(30))} ${String(sentences[displayData[v].index].text.content.length).padStart(4)}  ${sentences[displayData[v].index].text.content.slice(0, 120).padEnd(120)}`);
  //   }
  //   console.log('...');
  //   if (graph.length > 40) {
  //     for (let v = graph.length - 20; v < graph.length; v++) {
  //       let relativeScore = (displayData[v].score - bottomScore) / (topScore - bottomScore);
  //       let hsv = [120 * relativeScore, 100, 100]
  //       console.log(`${chalk.hsv(hsv)(String(displayData[v].score).padEnd(30))} ${String(sentences[displayData[v].index].text.content.length).padStart(4)}  ${sentences[displayData[v].index].text.content.slice(0, 120).padEnd(120)}`);
  //     }
  //   }
  // }

  // compress sentences into sets of good tokens, using syntactic information from tokens array
  this.compressSentences = function() {
    const DESIRABLE_TOKEN_TAGS = ['NOUN', 'ADJ'];

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

  // TODO: function makeWordGraph(sentences, tokens) {

  this.makeSentenceGraph = function() {
    let graph = this.compressSentences(sentences, tokens);
    for (let v = 0; v < graph.length; v++) {
      graph[v].score = 1;
      graph[v].edges = [];
      totalWeight = 0;
      for (let w = 0; w < graph.length; w++) {
        if (v !== w) {
          let intersection = this.intersect(graph[v].tokens, graph[w].tokens);
          if (intersection.size > 0) {
            // The TextRank algorithm proposes scaling the intersection size down by a factor proportional
            // to the log of the product of sentence lengths. Here we will not take the log; as a result,
            // longer sentences are penalized and the top-ranking sentences will be pleasantly short.
            //
            // Paper version: weight = intersection.size / (Math.log(graph[v].sentenceLength) + Math.log(graph[w].sentenceLength));

            // TODO: account for weights of tokens, i.e., replace intersection.size with sum of individual weights
            weight = intersection.size / (graph[v].sentenceLength * graph[w].sentenceLength);
            totalWeight += weight;
            graph[v].edges.push({
              tail: w,
              weight,
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

  this.scoreGraph = function(graph) {
    // 0 ≤ D ≤ 1 is the damping factor, a magic number from TextRank paper (following PageRank, q.v.)
    // usually set to 0.85. It controls how much score is transferred from each vertex at each iteration.
    const D = 0.85;
    const MAX_ITERATIONS = 1000;
    const ERROR_THRESHOLD = 0.000001;

    // iterate until ∆score < threshold for each vertex
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      let newScore = [];
      for (let v = 0; v < graph.length; v++) {
        let incomingScore = 0;
        for (let e = 0; e < graph[v].edges.length; e++) {
          let w = graph[v].edges[e].tail;
          incomingScore += graph[w].edges.filter(edge => edge.tail === v)[0].weight * graph[w].score;
        }
        newScore[v] = (1 - D) + D * incomingScore;
      }

      let worstError = -Infinity;
      for (let v = 0; v < graph.length; v++) {
        worstError = Math.max(worstError, Math.abs(newScore[v] - graph[v].score));
        graph[v].score = newScore[v];
      }

      if (worstError < ERROR_THRESHOLD) { break; }
    }
    return graph;
  }

  this.rankSentences = function() {
    let graph = this.scoreGraph(this.makeSentenceGraph());
    graph.sort((v, w) => w.score - v.score);
    return graph.map(v => (
      {
        sentence: sentences[v.index],
        score: v.score,
      }
    ));
  }
};

// Data structure reference
//
// meaningfulSentences = [
//   {
//     index:          int    index in original sentences array
//     sentenceLength: int    length of original sentence: N.B. for now this is measured in characters, not words
//     tokens:         Set    set of good token words in lower case
//   }
// ]