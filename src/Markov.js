const { Worker } = require('node:worker_threads');

const JOBS = {
  CREATE_SENTENCE: 'create_sentence',
  CHOOSE_RANDOM_PREV_WORD: 'find_rand_prev_word',
  CHOOSE_RANDOM_NEXT_WORD: 'find_rand_next_word',
};

const __END__ = 1;
const __START__ = 0;

module.exports.MarkovChain = function(size = 1) {
  this.tokenSize = size;
  this.chain = new Map();
  this.startWords = new Map();
  this.endWords = new Map();
  this.corpus = {
    chain: this.chain,
    startWords: this.startWords,
    endWords: this.endWords
  };

  // Add start and end symbols to the chian
  this.chain.set(__START__, {
      previousWords: new Map(),
      nextWords: new Map(),
      nw: 0,
      pw: 0,
  });
  this.chain.set(__END__, {
    previousWords: new Map(),
    nextWords: new Map(),
    nw: 0,
    pw: 0,
  });

  this._transformToTokenSize = (words = []) => {
    //Skip work if token size is 1. Assuming the incoming array is pre-split/tokenized(foreshadowing?)
    if(this.tokenSize === 1) {
      return words;
    }

    // Return the biggest possible token with given words is less than the token size
    if(this.tokenSize >= words.length) {
      return [words.join(' ')];
    }
    // For each element on the array, add the next <token size> elements to the current element
    const result = words.map((word, index, words) => {
      let list = [word];
      // This location in the arry will end up with the rest of the list, no need to keep going.
      // If this were a normal loop, a break could be used instead?
      if(words.length - index < this.tokenSize) {
        return;
      }
      //The actual adding to the word; "the meat" of the function
      for(i = 1; i < this.tokenSize; i++) {
        words[index+i] ? list.push(words[index+i]) : null;
      }
      return list.join(' ');
    // slice off the rest of the array, we end with a smaller array.
    }).slice(0, -this.tokenSize + 1);
    return result;
  }

  this.buildChain = function(words, metadata) {
    //Inject timestamp to ID metadata
    const timestamp = Date.now();
    metadata = {
      ...metadata,
      mid: timestamp,
    }

    // Set the word size from the token size
    words = this._transformToTokenSize(words);
    // Iterate over the words and add each word to the chain
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if(word === '' || !word) {
        // console.error(`Cannot index ${word}: `, word);
        return;
      }
      // If the word is not already in the chain, add it
      if (!this.chain.has(word)) {
        this.chain.set(word, {
          refs: {},
          nextWords: new Map(),
          nw: 0,
          previousWords: new Map(),
          pw: 0,
        });
      }

      this.chain.get(word).refs[timestamp] = {timestamp, ...metadata};
      // If is a start word, and isn't already indexed as a start word
      if(i === 0 && !this.startWords[word]) {
        this.startWords.set(word, this.chain.get(word));
        this.chain.get(__START__).nextWords.set(word, (this.chain.get(__START__).nextWords.get(word) || 0) + 1);
        this.chain.get(__START__).nw++;
      }

      // If is an end word, and isn't already indexed as an end word
      if(i == (words.length - 1) && !this.endWords.has(word)) {
        this.endWords.set(word, this.chain.get(word));
        this.chain.get(__END__).previousWords.set(word, (this.chain.get(__END__).previousWords.get(word) || 0) + 1);
        this.chain.get(__END__).pw++;
      }

      // If there is a next word, add it to the list of next words for the current word
      if (i < words.length) {
        const nextWord = words[i+1];
        this.chain.get(word).nextWords.set(nextWord, (this.chain.get(word).nextWords.get(nextWord) || 0) + 1);
        this.chain.get(word).nw++;
      }

      //If there is a previous word, add it to the list of previous words for the current word
      if (i > 0) {
        const previousWord = words[i-1];
        this.chain.get(word).previousWords.set(previousWord, (this.chain.get(word).previousWords.get(previousWord) || 0) + 1);
        this.chain.get(word).pw++;
      }
    }
  };

  this.addString = function(sentence, data) {
    if(Array.isArray(sentence)) {
      sentence.forEach( (str, index, arr) => {
        if(typeof str === 'string') {
          this.addString(str, data, arr[index+1]);
        } else if(Array.isArray(str)) {
          // Perhapse flatten incoming arrays?
          console.warn('Do not feed Arrays of Arrays');
          return;
        } else {
          console.warn(`${str}(${typeof str}) is not supported`);
        }
      });
    } else if(sentence === undefined || sentence === ' ' || sentence === '' || sentence === null) {
      return;
    } else if (sentence) {
      if(!sentence.split) {
        console.warn(sentence, 'is a bad egg');
        return;
      }
      const words = sentence.trim().split(' ');
      if(!Array.isArray(words)) {
        console.error(words, 'is not array');
        return;
      }
      this.buildChain(words, { ...data});
    }
  }

  this.generateSentence = async function(options = {}) {
    // If options are just a string, set it as the input option
    if(typeof options === 'string') {
      options = {
        input: options
      };
    }

    let {
      input,
      retries = 20,
      filter = (result) => result.text.split(' ').length >= 2,
    } = options;

    let sentence = '';
    const inputStates = this._transformToTokenSize(input?.split(' ')) ?? [];
    input = inputStates.find(inputState => this.chain.has(inputState))

    console.debug('Generating', `input: ${input}`)

    for(let i = 0; i < retries; i++) {
      const sWords = Array.from(this.startWords.keys());
      let referenced = {};

      input = input ?? sWords[Math.floor(Math.random()*sWords.length)];
      // Start the sentence with the starting word
      // sentence = this.startWords.get(input) ? input.split(' ').shift() : input;

      const chainWorkers = [
        _createStartChainWorker(this.corpus, input),
        _createEndChainWorker(this.corpus, input)
      ];

      const [startChain, endChain] = await Promise.all(chainWorkers)
      // Join all the lists, then handle the overlap larger tokens will have
      sentence = _removeOverlap(startChain.list.concat(input).concat(endChain.list)).join(' ');
      referenced = {...startChain.referenced, ...endChain.referenced};

      const result = {
        refs: referenced,
        text: sentence,
        string: sentence,
      }
      // Check if the sentence passes the filter
      if(filter(result)) {
        // Resolve and return sentence
        return(result);
      }
    }
    throw(`Could not generate sentence after ${retries} attempts`);
  };

  const _createEndChainWorker = (corpus, word) => {
    return new Promise((resolve, reject) => {
      const endChainWorker = new Worker(`${__dirname}/Workers.js`, {
        workerData: {
          corpus,
          job: JOBS.CHOOSE_RANDOM_NEXT_WORD,
          options: {
            word          
          }
        }
      });
      endChainWorker.on('message', resolve);
      endChainWorker.on('messageerror', reject);
    });
  }

  const _createStartChainWorker = (corpus, word) => {
    return new Promise((resolve, reject) => {
      const endChainWorker = new Worker(`${__dirname}/Workers.js`, {
        workerData: {
          corpus,
          job: JOBS.CHOOSE_RANDOM_PREV_WORD,
          options: {
            word          
          }
        }
      });
      endChainWorker.on('message', resolve);
      endChainWorker.on('messageerror', reject);
    });
  }

  // Remove all the overlap on the list of tokens provided
  const _removeOverlap = (tokens) => {
    // Iterate over all tokens, and keep only the first element except on the last token
    // use the entirety of the last token
    const resplit = tokens.map((token, index, tokens) => {
      if(index === tokens.length - 1) {
        return token;
      }
      return token.split(' ')[0];
    });
    return resplit
  }
}

// Example
module.exports.example = function() {
  const markovChain = new exports.MarkovChain('hello world this is a string with metadata');
  markovChain.buildChain();

  const sentence = markovChain.generateSentence('hello');
  // "hello world this is a string"
  console.log(sentence);
  return(sentence);
}
