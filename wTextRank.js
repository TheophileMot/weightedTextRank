module.exports = function(textData, tokenWeightFunction = (tokenIndex, sentence) => 1) {
  const { sentences: dataSentences, tokens: dataTokens } = textData;

  this.rankSentences = function() {
    let matchedSentences = this.matchSentencesWithTokens();
    let sentenceWeights = matchedSentences.map(sentence => this.weightSentence(sentence));
    let graph = this.makeSentenceGraph(matchedSentences, sentenceWeights);
    graph = this.scoreGraph(graph);
    graph.sort((v, w) => w.score - v.score);
    return graph;
  }

  this.weightSentence = function(sentence) {
    let totalWeight = 1;
    for (let tokenIndex = 0; tokenIndex < sentence.tokens.length; tokenIndex++) {
      totalWeight *= tokenWeightFunction(tokenIndex, sentence);
    }
    // console.log(`${sentence.text.content} : ${totalWeight}`)
    return totalWeight;
  }

  // Score the vertices using TextRank algorithm: iteratively share score to neighbours until stable.
  // 0 ≤ D ≤ 1 is the damping factor, a magic number from TextRank paper (following PageRank, q.v.)
  // usually set to 0.85. It controls how much score is transferred from each vertex at each iteration.
  this.scoreGraph = function([vertices, outgoingEdges]) {
    const D = 0.85;
    const MAX_ITERATIONS = 1000;
    const ERROR_THRESHOLD = 0.000001;

    // iterate until ∆score < threshold for each vertex
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      let newScore = [];
      for (let v = 0; v < vertices.length; v++) {
        let incomingScore = 0;
        for (let e = 0; e < outgoingEdges[v].length; e++) {
          let w = outgoingEdges[v][e].tail;
          incomingScore += outgoingEdges[w].filter(edge => edge.tail === v)[0].weight * vertices[w].score;
        }
        newScore[v] = (1 - D) + D * incomingScore;
      }

      let worstError = -Infinity;
      for (let v = 0; v < vertices.length; v++) {
        worstError = Math.max(worstError, Math.abs(newScore[v] - vertices[v].score));
        vertices[v].score = newScore[v];
      }

      if (worstError < ERROR_THRESHOLD) { break; }
    }
    return vertices;
  }

  // Make a graph with vertices representing sentences; calculate edge weights according to
  // overlapping key tokens.
  this.makeSentenceGraph = function(vertices, sentenceWeights) {
    let outgoingEdges = [];
    for (let v = 0; v < vertices.length; v++) {
      vertices[v].score = 1;
      outgoingEdges[v] = [];
      totalWeight = 0;
      for (let w = 0; w < vertices.length; w++) {
        if (v !== w) {
          let intersection = this.intersect(vertices[v].keyTokens, vertices[w].keyTokens);
          if (intersection.size > 0) {
            weight = intersection.size / (Math.log(vertices[v].text.content.length) + Math.log(vertices[w].text.content.length));
            weight *= sentenceWeights[v] * sentenceWeights[w];
            totalWeight += weight;
            outgoingEdges[v].push({
              tail: w,
              weight,
            });
          }
        }
      }
      // normalize outgoing edge weights
      for (let edge of outgoingEdges[v]) {
        edge.weight /= totalWeight;
      }
    }

    return [vertices, outgoingEdges];
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