module.exports = function(textData) {
  const { sentences: dataSentences, tokens: dataTokens } = textData;

  this.rankSentences = function() {
    let graph = this.scoreGraph(this.makeSentenceGraph());
    graph.sort((v, w) => w.score - v.score);
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

  // The TextRank algorithm proposes scaling the intersection size down by a factor proportional
  // to the log of the product of sentence lengths. Here we will not take the log; as a result,
  // longer sentences are penalized and the top-ranking sentences will be pleasantly short.
  //
  // Paper version: weight = intersection.size / (Math.log(graph[v].text.length) + Math.log(graph[w].text.length));
  this.makeSentenceGraph = function() {
    let graph = this.matchSentencesWithTokens();
    for (let v = 0; v < graph.length; v++) {
      graph[v].score = 1;
      graph[v].edges = [];
      totalWeight = 0;
      for (let w = 0; w < graph.length; w++) {
        if (v !== w) {
          let intersection = this.intersect(graph[v].keyTokens, graph[w].keyTokens);
          if (intersection.size > 0) {
            // TODO: account for weights of tokens, i.e., replace intersection.size with sum of individual weights
            weight = intersection.size / (graph[v].text.length * graph[w].text.length);
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

  // The Google API gives a single array of tokens without saying which sentence belong to; we need to
  // reconstruct the sentences one at a time and store the associated token information. Along the way,
  // record lemmatized desirable tokens (nouns and adjectives).
  this.matchSentencesWithTokens = function() {
    const DESIRABLE_TOKEN_TAGS = ['NOUN', 'ADJ'];

    let searchStartPos = 0;
    let tokenIndexOffset = 0;
    let sentencesIndex = 0;

    let matchedSentences = [];

    for (let token of dataTokens) {
      let word = token.text.content;
      let sentence = dataSentences[sentencesIndex].text.content;
      let pos = sentence.indexOf(word, searchStartPos);
      while (pos === -1) {
        // Token not found: reset search start position; update token offset so that indices
        // are relative to current sentence, not entire body of text; move to next sentence.
        searchStartPos = 0;
        tokenIndexOffset += matchedSentences[sentencesIndex].tokens.length;
        sentencesIndex++;
        if (sentencesIndex >= dataSentences.length) {
          throw (`Error in matchSentencesWithTokens: tokens don't match sentences. Stopped looking at "${word}".`);
        }
        let sentence = dataSentences[sentencesIndex].text.content;
        pos = sentence.indexOf(word, searchStartPos);
      }
      searchStartPos = pos + 1;

      if (sentencesIndex === matchedSentences.length) {
        matchedSentences[sentencesIndex] = {
          text: {
            content: dataSentences[sentencesIndex].text.content,
          },
          tokens: [],
          keyTokens: new Set,
        };
      }
      matchedSentences[sentencesIndex].tokens.push(
        { text: {
            content: token.text.content,
          },
          partOfSpeech: {
            tag: token.partOfSpeech.tag,
          },
          dependencyEdge: {
            headTokenIndex: token.dependencyEdge.headTokenIndex - tokenIndexOffset,
            label: token.dependencyEdge.label,
          },
          lemma: token.lemma.toLowerCase(),
        }
      );
      if (DESIRABLE_TOKEN_TAGS.includes(token.partOfSpeech.tag)) {
        matchedSentences[sentencesIndex].keyTokens.add(token.lemma.toLowerCase());
      }
    }

    return matchedSentences;
  }

  this.intersect = function(setA, setB) {
    let result = new Set;
    setA.forEach(x => {
      if (setB.has(x)) {
        result.add(x);
      }
    });
    return result;
  }

  // TODO: function makeWordGraph() { ... }
};