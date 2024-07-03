const { parentPort, workerData } = require('node:worker_threads');

const JOBS = {
    CREATE_SENTENCE: 'create_sentence',
    CHOOSE_RANDOM_PREV_WORD: 'find_rand_prev_word',
    CHOOSE_RANDOM_NEXT_WORD: 'find_rand_next_word',
};

const __END__ = 1;
const __START__ = 0;

// WIP
const _generateStentnce = async (corpus, input) => {
    const chainWorkers = [
        _createStartChainWorker(corpus, input),
        _createEndChainWorker(corpus, input)
      ];
    try {
        const [startChain, endChain] = await Promise.all(chainWorkers)
        sentence = _removeOverlap(startChain.list.concat(input).concat(endChain.list)).join(' ');
        referenced = {...startChain.referenced, ...endChain.referenced};

        return Promise.resolve({
            refs: referenced,
            text: sentence,
            string: sentence,
        })
    } catch (e) {
        return Promise.reject(e);
    }

}

const _findChainEnd = (corpus, word) => {
    const { chain, endWords } = corpus;
    let referenced = {};
    let initTime = Date.now();
    let currentWord = word;
    let sentence = '';
    let list = [];
    const pickedWords = new Set();

    // Keep generating words until we reach the end of the chain
    while (currentWord && chain.has(currentWord) && currentWord !== 1) {
        if (Date.now() - initTime > 6000) {
            const eWords = Array.from(endWords.keys());
            currentWord = eWords[Math.floor(Math.random() * eWords.length)];
            console.warn(`Markov took too long("${sentence}"). Forcing: " ${currentWord}"`);
            pickedWords.add(currentWord);
            list.push(currentWord);
            sentence = ` ${currentWord}`;
            break;
        }
        // Choose a random next word from the list of next words for the current word
        const nextWord = _chooseRandomNextWord(corpus, currentWord);
        
        // If we couldn't choose a next word, break out of the loop
        if (!nextWord || ((sentence + sentence).indexOf(sentence, 1) != sentence.length)) {
            break;
        }

        if(pickedWords.size > 0 && sentence.split(' ').length > (pickedWords.size * 2)) {
            break;
        }

        // Add the next word to the sentence
        sentence += ' ' + nextWord.split(' ').shift();

        pickedWords.add(nextWord);
        list.push(nextWord)
        // Set the current word to the next word
        currentWord = nextWord;
        referenced = { ...referenced, ...chain.get(nextWord)?.refs };
    }
    return {sentence, referenced, list};
}

// A helper function that chooses a random next word from the list of next words for a given word
const _chooseRandomNextWord = (corpus, word) => {
    const { chain, endWords } = corpus;
    // Get the list of next words for the given word
    const nextWords = chain.get(word).nextWords;

    // If there are no next words, return null
    if (nextWords.size === 0) {
        return null;
    }

    // Choose a random index from the list of next words
    const nextWordIndex = Math.floor(Math.random() * nextWords.size);

    // Choose the next word based on it's weight.
    /*
     * What if calculated weights like this and select for multiple paths at once?
     * W -> a || b || c
     * a -> t || u
     * b -> v
     * c -> x || y || z
     * At state W = [a, b, c] as [10, 5, 6]
     * a = [t, u] as [8, 2]
     * b = [v] as [7]
     * c = [x, y, z] as [4, 10, 3]
     * 
     * So that [10, 5, 6] * [[8,2],[7],[4,10,3]]
    */
    const select = Math.random() * chain.get(word).nw + 1;
    let accumulate = chain.get(word).nw;
    let picked = Array.from(nextWords.keys())[nextWordIndex];
    for (const next of nextWords.keys()) {
        accumulate -= nextWords.get(next);
        const inAfterWords = Object.values(chain.get(word).refs).some((reference) => {
            word.split(' ').some(w => {
                return reference?.afterWords?.includes(w);
            })
        });
        if (accumulate <= select && next !== word || inAfterWords) {
            picked = next;
            break;
        }
    }
    // Return the next word picked.
    return picked;

};

const _findChainStart = (corpus, word) => {
    const { chain, startWords } = corpus;
    let referenced = {};
    let initTime = Date.now();
    let currentWord = word;
    let sentence = '';
    let list = [];
    const pickedWords = new Set();

    while (currentWord && chain.has(currentWord) && currentWord !== 0) {
        // Stop if taking too long
        if (Date.now() - initTime > 6000) {
            const sWords = Array.from(startWords.keys());
            currentWord = sWords[Math.floor(Math.random() * sWords.length)];
            console.warn(`Markov took too long("${sentence}"). Forcing: "${currentWord} "`);
            pickedWords.add(currentWord);
            list.push(currentWord)
            sentence = `${currentWord} `;
            break;
        }

        // Choose a random previous word from the list of previous words for the current word
        const previousWord = _chooseRandomPreviousWord(corpus, currentWord);

        // If we couldn't choose a previous word, break out of the loop
        if (!previousWord || ((sentence + sentence).indexOf(sentence, 1) != sentence.length)) {
            break;
        }

        if (pickedWords.size > 0 && sentence.split(' ').length > (pickedWords.size * 2)) {
            break;
        }

        // Prenpend to previous word to the sentence
        sentence = previousWord.split(' ').pop() + ' ' + sentence;

        pickedWords.add(previousWord);
        list.push(previousWord)
        // Set the current word to the previous word
        currentWord = previousWord;
        referenced = { ...referenced, ...chain.get(previousWord)?.refs };
    }
    return {sentence, referenced, list: list.reverse()};
}

// A helper function that chooses a random previous word form the list of previous words for a given word
const _chooseRandomPreviousWord = function (corpus, word) {
    const { chain, startWords } = corpus;
    // Get the list of previous words for the given word
    const previousWords = chain.get(word).previousWords;
    // If there are no previous words, return null
    if (previousWords.size === 0) {
        return null;
    }

    // Choose a random index from the list of previous words
    const previousWordIndex = Math.floor(Math.random() * previousWords.size);

    // Return the previous word at the chosen index

    // Choose the next word based on it's weight.
    const select = Math.random() * chain.get(word).pw + 1;
    let accumulate = chain.get(word).pw;
    let picked = Array.from(previousWords.keys())[previousWordIndex];
    for (const previous of previousWords.keys()) {
        accumulate += previousWords.get(previous);
        if (accumulate <= select && previous !== word) {
            picked = previous;
            break;
        }
    }
    // Return the previous word picked.
    return picked;
}

const _removeOverlap = (tokens) => {
    const resplit = tokens.map((token, index, tokens) => {
      if(index === tokens.length - 1) {
        return token;
      }
      return token.split(' ')[0];
    });
    return resplit
}

switch (workerData?.job) {
    case JOBS.CREATE_SENTENCE:
        _generateStentnce(workerData.corpus, workerData.options).then(parentPort.postMessage)
        break;
    case JOBS.CHOOSE_RANDOM_PREV_WORD:
        parentPort.postMessage(_findChainStart(workerData.corpus, workerData.options.word));
        break;
    case JOBS.CHOOSE_RANDOM_NEXT_WORD:
        parentPort.postMessage(_findChainEnd(workerData.corpus, workerData?.options.word));
        break;
    default:
        throw (`${workerData?.job} is not a valid job.`)
}

module.exports.JOBS = JOBS;