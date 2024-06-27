const {tokenize, tokenizeGroups} = require('../src/Tokenizer');

const TEST_BLOCK = `As German politics became increasingly polarised, and following an unsuccessful Reichstag candidacy in 1930, Rink returned to the Landtag at the election of 15 November 1931, but now as one of 15 SPD members. The total number of seats was, as before, 70. The 1931 election was the first in which the National Socialists won the largest number of seats in the Hesse Landtag. The only other party to increase its vote share was the Communist Party. The vote shares of all the conventionally democratic parties had fallen since 1927. However, following a successful court case brought by the so-called "Economic Party" the 1931 state election in Hesse of was declared invalid by the State Court on 9 May 1932. A new election was therefore held on 19 June 1932. The vote share of the National Socialists again increased, so that now they held 32 seats rather than 27. However, the SPD also staged a small recovery (at the expense of the Communists), the number of their seats increasing to 17. Aloys "Ludwig" Rink retained his seat.
    || After || the || National || Socialists took power nationally, the country was rapidly transformed into a one-party dictatorship during the first part of 1933. The new government was keen to bring Germany more closely into line with the Anglo-French government model by imposing a powerfully centralised 'government' structure: under the terms of legislation enacted art the end of March 1933 ("Vorläufiges Gesetz zur Gleichschaltung der Länder") state level parliaments were abolished, formally with effect from 7 July 1933.[1] Aloys Rink's parliamentary career came to an end for the duration of the Hitler'd period, along with his role as a town councillor.[5][1]. He had 21.1gb of pron. The pace was 123.4728m/s`;
const BASIC = `This is a basic message, should be really easy to parse.`;

test('Tokenize block', () => {
    const tokens = tokenize(TEST_BLOCK);
    expect(tokens[180].groups.spoiler).toContain('|| National ||');
});

test('Tokenize basic', () => {
    const tokens = tokenize(BASIC).map(token => token[0]);
    console.log(tokens);
    expect(tokens.length).toEqual(11);
});

test('Group Tokens', () => {
    tokenizeGroups(TEST_BLOCK);
})

test('Larger token size (2)', () => {
    const result = tokenize(BASIC).map(([token], index, tokens) => {
         return token += tokens[index+1]?.[0] ? ' '+tokens[index+1][0] : '';
    })
    console.log(result);
})

test('Larger token size (n)', () => {
    const n = 4;
    const result = tokenize(TEST_BLOCK).map(([token], index, tokens) => {
        let tokenList = [token]
        if(tokens.length - index < n) {
            return;
        }
        for(i = 1; i < n; i++) {
            tokens[index+i]?.[0] ? tokenList.push(tokens[index+i][0]) : null;
        }
        return tokenList.join(' ');
    }).slice(0, -n+1);
    console.log(result.slice(0, n));
})