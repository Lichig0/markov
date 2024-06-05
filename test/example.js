const Markov = require('../src/Markov');
const wiki = require('wikipedia');
const Chance = require('chance');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

const chance = new Chance();
const trimmer = new RegExp('==.*==|\n|^$', 'g');
const punctuation = new RegExp('[^.!?]*[.!?]', 'g');

const getwiki = async () => {
  try {
    const events = Object.values(await wiki.onThisDay({ type: 'events' }))[0];
    // console.log(events);
    const dayAllContent = [];
    // const pageSummary = chance.pickone(Object.values(events)[0].pages);
    const pageSummary = Object.values(events)[0].pages[0];
    // Object.values(events)[0].pages.forEach(async pageSummary => {
    //   const page = await wiki.page(pageSummary.title);
    //   dayAllContent.push(await page.content());
    // });
    console.log('Fetched wiki article title:', pageSummary.title);
    const page = await wiki.page(pageSummary.title)
    // console.log('page', page);
    const content = await page.content();
    console.log('Content: ', content);
    // console.log(dayAllContent)
    return (content);
  } catch (error) {
    console.log(error);
  }
};

const getRandomWiki = async () => {
  try {
    const pageSummary = await wiki.random();
    console.log('Fetched wiki article title:', pageSummary.title);
    const page = await wiki.page(pageSummary.title);
    const content = await page.content();
    console.log('Content: ', content);
    return content;
  } catch (error) {
    console.error(error);
  }
};

const searchWiki = async (searchText) => {
  return new Promise((resolve, reject) => {
    try {
      const contentRequests = [];
      const pageRequests = [];
      wiki.search(searchText).then(response => {
        //Slice to limit requests.
        response.results.slice(0, -6).forEach(result => {
          pageRequests.push(wiki.page(result.title));
        });
        Promise.allSettled(pageRequests).then(pages => {
          pages.forEach(page => {
            if (page.value) {
              contentRequests.push(page.value.content());
            }
          })
          Promise.allSettled(contentRequests).then(contentArray => {
            resolve(contentArray.map(ca => ca.value).filter(c => c !== undefined));
          });
        })
      });
    } catch (error) {
      reject(error);
    }
  });

}

const contentToArray = (wikiContent) => {
  const trimmed = wikiContent.split(trimmer).filter(blocks => blocks !== '');
  const sentences = trimmed.flatMap(block => block.match(punctuation)).filter(s => s !== null);
  return sentences;
};


const mChain = new Markov.MarkovChain(1);
console.log('Building chain....');
const pref = {
  showIn: false,
};

readline.question('Search Wikipedia:\n>', input => {
  searchWiki(input).then(async contentArray => {
    if (pref.showIn) console.log(contentArray);
    const sentences = [];
    contentArray.forEach(content => {
      sentences.push(...contentToArray(content));
    });
    // console.log(sentences);
    mChain.addString(sentences, { source: 'Wiki', nsfw: true });
    // sentences.forEach(sentence => {
    // });

    const exampleFilter = (result) => {
      return result.text.split(' ').length >= 2
    };

    const newWiki = await mChain.generateSentence({ input: input, filter: exampleFilter }).catch(console.error);
    console.log(newWiki?.text);
    readline.close();
  });
});
