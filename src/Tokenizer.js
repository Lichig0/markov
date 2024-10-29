const REGEX_PARTS = {
  DISCORD_EMOJI_TAG: /(?<emojiID>(<:[a-zA-Z0-9_]{2,}:){1}([0-9]{18})>)/,
  DISCORD_USER_TAG: /(?<userID>(<@){1}([0-9]{18})>)/,
  DISCORD_CHANNEL_TAG: /(?<channelID>(<#){1}([0-9]{18})>)/,
  URL: /(?<url>(https*:\/\/){0,1}[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&\/\/=]*)?)/,
  NUMBER: /(?<number>\d+[,.]?(?=\d)\d*|\d)/,
  WORD_REGEX: /(?<word>[^,.\/#!?$%\^&\*;:{}=\-_\`~()\[\]\s\|\"\'\d]+(?<punc>[.!?]*[.!?])?)/, // More like NOT anything that ISN'T a word
  APOSTROPHE: /(?<apostrophe>(?<=[a-zA-Z])'[a-zA-Z]+)/,
  SPOILER: /(?<spoiler>\|\|(?<=\|\|)[^|]*(?=\|\|)\|\|)/,
}

const FULL_REGEX = new RegExp(Object.values(REGEX_PARTS).reduce((a,b) => new RegExp(a.source + "|" + b.source)),'gd');

const _validateInput = function(input) {
  if(typeof input !== 'string') {
    throw new Error(`${input} is not typeof string`);
  }

  if(input === undefined 
    || input === ' '
    || input === ''
    || input === null) {
      throw new Error('Cannot tokenize empty string');
  }
}

const _tokenize = function(input, regex, all = false) {
  try {
    _validateInput(input)
  } catch(e) {
    console.error(e.message);
    return undefined;
  }

  return all ? [...input.matchAll(regex)] : [...input.match(regex)];
}

module.exports.tokenize = function(input) {
  return _tokenize(input, FULL_REGEX, true);
}

module.exports.tokenizeAll = function(input) {
  return _tokenize(input, FULL_REGEX, false)
}

module.exports.tokenizeGroups = function(input) {
  let match;
  let result = [];
  while ((match = FULL_REGEX.exec(input)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (match.index === FULL_REGEX.lastIndex) {
        FULL_REGEX.lastIndex++;
    }
    
   result.push({
    text: match[0],
    groups: {...match.groups}
   })
  }
  return result;
}

module.exports.groupTokens = function(tokens) {
  const groups = {};
  tokens.forEach(token => {
      Object.entries(token.groups).forEach(([k,v]) => {
          if(v) {
              groups[k] = groups[k] ? [...groups[k], v] : [v]
          }
      });
  });
  return groups;
}

module.exports.REGEX_GROUPS = REGEX_PARTS;