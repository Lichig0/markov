const Markov = require('../src/Markov');

let markovChain;
const outputs = [];
const exampleSentence = 'Hello world this is a string with metadata!';
const exampleMetadata = { tag: 12345, aBool: true}
const staticPrng = () => 0.69;
// const staticResponse = "By analogy, quasi-Monte Carlo methods, which rely on random sequence of 7 will tend to occur twice as often has no order and 9 blue."
const difficultFilter = (result) => result.text.trim().split(' ').length >= 2 && result.text.split(' ').length <= 30;


const TEST_INPUT = [
  'In common usage, randomness is the apparent or actual lack of pattern or predictability in events.',
  'A random sequence of events, symbols or steps often has no order and does not follow an intelligible pattern or combination.',
  'Individual random events are, by definition, unpredictable, but if the probability distribution is known, the frequency of different outcomes over repeated events (or "trials") is predictable.',
  'For example, when throwing two dice, the outcome of any particular roll is unpredictable, but a sum of 7 will tend to occur twice as often as 4!',
  'In this view, randomness is not haphazardness; it is a measure of uncertainty of an outcome.',
  'Randomness applies to concepts of chance, probability, and information entropy.',
  'The fields of mathematics, probability, and statistics use formal definitions of randomness!',
  'In statistics, a random variable is an assignment of a numerical value to each possible outcome of an event space.',
  'This association facilitates the identification and the calculation of probabilities of the events.',
  'Random variables can appear in random sequences.',
  'A random process is a sequence of random variables whose outcomes do not follow a deterministic pattern, but follow an evolution described by probability distributions.',
  'These and other constructs are extremely useful in probability theory and the various applications of randomness.',
  'Randomness is most often used in statistics to signify well-defined statistical properties.',
  'Monte Carlo methods, which rely on random input (such as from random number generators or pseudorandom number generators), are important techniques in science, particularly in the field of computational science.',
  'By analogy, quasi-Monte Carlo methods use quasi-random number generators!',
  'Random selection, when narrowly associated with a simple random sample, is a method of selecting items (often called units) from a population where the probability of choosing a specific item is the proportion of those items in the population.',
  'For example, with a bowl containing just 10 red marbles and 90 blue marbles, a random selection mechanism would choose a red marble with probability 1/10.',
  'Note that a random selection mechanism that selected 10 marbles from this bowl would not necessarily result in 1 red and 9 blue.',
  'In situations where a population consists of items that are distinguishable, a random selection mechanism requires equal probabilities for any item to be chosen.',
  'That is, if the selection process is such that each member of a population, say research subjects, has the same probability of being chosen, then we can say the selection process is random.',
  'uncertainty'
]
const LOOP_INPUT = [
  'This input is forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loop forever in a loopforever in a loop forever in a loop.',
  'Does this sentence loop forever loop forever loop forever loop forever loop forever  loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever loop forever',
  '... 1 ... 2 ... 3 ... 1 ... 2 ... 3 ... 2 ... 3 ... 2 ... 1 ... 2 ... 3 ... 2 ... 3 ... 1 ...'
]

beforeEach(() => {
  markovChain = new Markov.MarkovChain();
});

afterEach(() => {
  markovChain = undefined;
})

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation();
  jest.spyOn(Math, 'random').mockImplementation(staticPrng);
});

afterAll(() => {
  jest.restoreAllMocks();
  console.log(outputs);
});

test('Say hello?', async () => {
  markovChain.addString(exampleSentence);
  const ask = 'Hello';
  const newSentence = await markovChain.generateSentence(ask);
  outputs.push(newSentence.text);

  expect(newSentence.text).toContain(ask);
});

test('Say hello from the middle', async () => {
  markovChain.addString(exampleSentence);
  const ask = 'this';
  const newSentence = await markovChain.generateSentence(ask);

  outputs.push(newSentence.text);
  expect(newSentence.text).toContain(ask);
});

test('Find Sentence', async () => {
  TEST_INPUT.forEach(sentence => {
    markovChain.addString(sentence);
  });
  const newSentence = await markovChain.generateSentence({input: 'random'})
  outputs.push(newSentence.text);
  expect(newSentence.text).toContain('random');
  // expect(newSentence.text).toContain(staticResponse);
});

test('Accept Arrays', async () => {
  markovChain.addString(TEST_INPUT);

  const newSentence = await markovChain.generateSentence({input: 'random'})
  outputs.push(newSentence.text);
  expect(newSentence.text).toContain('random');
  // expect(newSentence.text).toContain(staticResponse);
});

test('Generate from no input', async () => {
  markovChain.addString(TEST_INPUT);

  const newSentence = await markovChain.generateSentence();
  outputs.push(newSentence.text);
  expect(newSentence.text).not.toContain('undefined');
});

test('Difficult filter', async () => {
  markovChain.addString(TEST_INPUT);

  const newSentence = await markovChain.generateSentence({input: 'outcomes', filter: difficultFilter});
  outputs.push(newSentence.text);
  expect(newSentence.text).toContain('outcomes');
});

test('Reject bad strings', () => {
  markovChain.addString('');
  expect(markovChain.chain.size).toEqual(2);
  markovChain.addString([['asdf'],['asdf']]);
  expect(console.warn).toBeCalledWith('Do not feed Arrays of Arrays');
  markovChain.addString(42);
  expect(console.warn).toBeCalledWith(42, 'is a bad egg');
  markovChain.addString({});
  expect(console.warn).toBeCalledWith({}, 'is a bad egg');
  markovChain.addString([{}, ' ']);
  expect(markovChain.chain.size).toEqual(2);
});

test('Metadata', async () => {
  markovChain.addString(exampleSentence, exampleMetadata);
  const newSentence = await markovChain.generateSentence('Hello');

  outputs.push(newSentence.text);
  expect(Object.values(newSentence.refs)[0].aBool).toEqual(exampleMetadata.aBool)
  expect(Object.values(newSentence.refs)[0].tag).toEqual(exampleMetadata.tag);
});

test('Fear loops', async () => {
  markovChain.addString(LOOP_INPUT);

  const newSentence = await markovChain.generateSentence('1');
  outputs.push(newSentence.text);
  expect(newSentence.text).toContain('1');
  const newSentence2 = await markovChain.generateSentence('loop');
  outputs.push(newSentence2.text);
  expect(newSentence2.text).toContain('loop');
});

test('Single word', async () => {
  markovChain.addString(TEST_INPUT);
  const newSentence = await markovChain.generateSentence({input: 'uncertainty', filter: difficultFilter});
  // const newSentence = await markovChain.generateSentence('uncertainty');
  outputs.push(newSentence.text);
  expect(newSentence.text).toContain('uncertainty')
})
