const { parentPort, workerData } = require('node:worker_threads');

const JOBS = {
    CREATE_SENTENCE: 'create_sentence',
    CHOOSE_RANDOM_PREV_WORD: 'find_rand_prev_word',
    CHOOSE_RANDOM_NEXT_WORD: 'find_rand_next_word',
};

const __END__ = 1;
const __START__ = 0;

const _generateStentnce = async (corpus, options) => {
    return new Promise((resolve, reject) => {
        reject('NOT IMPLEMENTED', corpus, options);
    });
}

const _findChainEnd = (corpus, word) => {
    const { chain, endWords } = corpus;
    let referenced = {};
    let initTime = Date.now();
    let currentWord = word;
    let sentence = '';
    const pickedWords = new Set();

    // Keep generating words until we reach the end of the chain
    while (currentWord && chain.has(currentWord) && currentWord !== 1) {
        if (Date.now() - initTime > 6000) {
            const eWords = Array.from(endWords.keys());
            currentWord = eWords[Math.floor(Math.random() * eWords.length)];
            console.warn(`Markov took too long("${sentence}"). Forcing: " ${currentWord}"`);
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
        // Set the current word to the next word
        currentWord = nextWord;
        referenced = { ...referenced, ...chain.get(nextWord)?.refs };
    }
    return {sentence, referenced};
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
    const pickedWords = new Set();

    while (currentWord && chain.has(currentWord) && currentWord !== 0) {
        // Stop if taking too long
        if (Date.now() - initTime > 6000) {
            const sWords = Array.from(startWords.keys());
            currentWord = sWords[Math.floor(Math.random() * sWords.length)];
            console.warn(`Markov took too long("${sentence}"). Forcing: "${currentWord} "`);
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
        // Set the current word to the previous word
        currentWord = previousWord;
        referenced = { ...referenced, ...chain.get(previousWord)?.refs };
    }
    return {sentence, referenced};
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