// ty https://leemartin.dev/creating-a-simple-spotify-authorization-popup-in-javascript-7202ce86a02f
// and https://medium.com/front-end-weekly/how-i-built-a-miniature-year-round-available-version-of-spotify-wrapped-e7625a30b58b

const scope = 'user-read-private playlist-read-private playlist-read-collaborative';
const token = window.location.hash.substring(1).split('&')[0].split("=")[1];
window.location.hash = '';

const redirect_uri = window.location.origin + '/bites/spotistats.php'; // automatically redirect to localhost or sophli.me

const getStatsButton = document.getElementById('get-stats');
const dataTypeInput = document.getElementById('data-type');
const clientIDInput = document.getElementById('client-id');

const timeTypeInput = document.getElementById('time-type');
const customSeasonContainer = document.getElementById('custom-season-container');
const customPeriodContainer = document.getElementById('custom-period-container');
const customDayContainer = document.getElementById('custom-day-container');
const seasonYearInput = document.getElementById('season-year');
const startingDateInput = document.getElementById('starting-date');
const endDateInput = document.getElementById('end-date');
const dayInput = document.getElementById('day');

const statsEl = document.getElementById('stats');
const audioStatsEl = document.getElementById('audio-stats');
const numSongsAddedEl = document.getElementById('num-songs-added');
const hrsAddedEl = document.getElementById('hrs-added');
const funStatEl = document.getElementById('fun-stat');
const songsDisplayTypeEl = document.getElementById('songs-display-type');

const msgContainer = document.getElementById('msg-container');
const rateLimitedMsg = `Uh oh, you're accessing the Spotify API too fast! Let's cool down a bit...`;
const noNewSongsMsg = 'No new songs added';
const loadingMsg = 'Loading...';

const listDisplay = document.getElementById('list-display');
const cloud = document.getElementById('cloud');
const cloudContainerWidth = '400';
const cloudContainerHeight = '400';

const particles = [];

var gettingStats = false;
var gotStats = false;
var curTypingId = 0; // increment when want to stop typing

var loadedIconForMsg = false;
var lastLoadedMsg = null;

setupEls();
checkAuth();

function checkAuth() {
    if (token) {
        getStatsLogic();
    }
}

function setupEls() {    
    setupSavedVals();
    getStatsButton.addEventListener('click', function () {
        if (startingDateInput && dataTypeInput) {
            let dataType = dataTypeInput.value;
            if (dataType) { // it should have it since it's a select but just in case ig
                if (dataType === 'use sample data') {
                    getStatsLogic();
                }
                else if (dataType === 'use my spotify') {
                    if (token) {
                        getStatsLogic();
                    }
                    else {
                        const AUTH_URL = createAuthURL();
                        if (AUTH_URL) {
                            window.location.href = AUTH_URL;
                        }
                        else {
                            alert('Input a valid client id!');
                        }
                    }
                }
            }
        }
    })

    updateTimeEls(timeTypeInput.value);

    // save funcs, need this in function instead of one line to save for some reason
    seasonYearInput.onchange = function () {
        localStorage.setItem('spotistats-season-year', seasonYearInput.value); 
    };

    startingDateInput.onchange = function () {
        localStorage.setItem('spotistats-start-date', startingDateInput.value); 
    };

    endDateInput.onchange = function () {
        localStorage.setItem('spotistats-end-date', endDateInput.value); 
    };

    dayInput.onchange = function () {
        localStorage.setItem('spotistats-day', dayInput.value); 
    };

    clientIDInput.onchange = function () {
        localStorage.setItem('spotistats-client-id', clientIDInput.value);
    };

    dataTypeInput.onchange = function () {
        localStorage.setItem('spotistats-data-type', dataTypeInput.value);
    };

    timeTypeInput.onchange = function () {
        updateTimeEls(this.value);
        localStorage.setItem('spotistats-time-type', timeTypeInput.value);
    }

    songsDisplayTypeEl.onchange = function() {
        localStorage.setItem('spotistats-display-type', songsDisplayTypeEl.value);
        if (songsDisplayTypeEl.value === 'display as list') {
            typeSongsConsec();      
        }
        else {
            cloud.style.display = 'block';
            listDisplay.style.display = 'none';           
        }
    }
}

function updateTimeEls(type) {
    if (type === 'spring' || type === 'summer' || type === 'fall' || type === 'winter') {
        customSeasonContainer.style.display = 'inline';
        customPeriodContainer.style.display = 'none';
        customDayContainer.style.display = 'none';
    }
    else if (type === 'custom period') {
        customPeriodContainer.style.display = 'inline';
        customSeasonContainer.style.display = 'none';
        customDayContainer.style.display = 'none';
    }
    else if (type === 'custom day') {
        customDayContainer.style.display = 'inline';
        customSeasonContainer.style.display = 'none';
        customPeriodContainer.style.display = 'none';
    }
}

function getStatsLogic() {
    if (gettingStats) {
        return;
    }

    let data = null;
    if (dataTypeInput.value === 'use sample data') {
        data = {songData, audioData};
    }

    if (timeTypeInput.value === 'custom period') {
        if (!startingDateInput.value && !endDateInput.value) {
            alert('Input a starting and end date!');
            return;
        }
        else if (!startingDateInput.value) {
            alert('Input a starting date!');
            return;
        }
        else if (!endDateInput.value) {
            alert('Input an end date!');
            return;
        }
        else if (endDateInput.value === startingDateInput.value) {
            alert(`Start and end date can't be the same! Try custom day if you want a specific day...`);
            return;
        }
        
        const startingDate = new Date(startingDateInput.value + ' '); // add space so it isn't off by a day (utc time)
        const endDate = new Date(endDateInput.value + ' ');
        
        if (endDate < startingDate) {
            alert(`End date can't be before start date! That's not how time works...`);
            return;
        }
        getStats({startingDate, endDate}, data);
    }
    else if (timeTypeInput.value === 'custom day') {
        if (!dayInput.value) {
            alert('Ínput a day!');
            return;
        }

        const day = new Date(dayInput.value + ' '); // add space so it isn't off by a day (utc time)
        getStats({startingDate: day, endDate: day}, data);
    }
    else {
        const season = timeTypeInput.value;
        const year = document.getElementById('season-year').value;
        if (!year) {
            alert('Input a year!');
            return;
        }
        getStats({season, year}, data);
    }
}

function createAuthURL() {
    const client_id = clientIDInput.value;
    if (client_id && client_id.length === 32) {
        return 'https://accounts.spotify.com/authorize?' +
        new URLSearchParams({
        response_type: 'token',
        client_id: client_id,
        scope: scope,
        redirect_uri: redirect_uri
        })
        + 
        '&'
        ;
    }
    else {
        return null;
    }
}

function setupSavedVals() {
    let savedTimeType = localStorage.getItem('spotistats-time-type');
    if (savedTimeType) {
        timeTypeInput.value = savedTimeType;
    }
    let savedSeasonYear = localStorage.getItem('spotistats-season-year');
    if (savedSeasonYear) {
        seasonYearInput.value = savedSeasonYear;
    }
    let savedStartDate = localStorage.getItem('spotistats-start-date');
    if (savedStartDate) {
        startingDateInput.value = savedStartDate;
    }
    let savedEndDate = localStorage.getItem('spotistats-end-date');
    if (savedEndDate) {
        endDateInput.value = savedEndDate;
    }
    let savedDay = localStorage.getItem('spotistats-day');
    if (savedDay) {
        dayInput.value = savedDay;
    }
    let clientID = localStorage.getItem('spotistats-client-id');
    if (clientID) {
        clientIDInput.value = clientID;
    }
    let dataType = localStorage.getItem('spotistats-data-type');
    if (dataType) {
        dataTypeInput.value = dataType;
    }
    let displayType = localStorage.getItem('spotistats-display-type');
    if (displayType) {
        songsDisplayTypeEl.value = displayType;
    }
}

function resetStatsDisplay() {
    curTypingId++; // stop current typing if any
    updateMsgContainer('');
    statsEl.style.display = 'none';
    hrsAddedEl.textContent = '';
    funStatEl.textContent = '';
    removeAllChildElements(cloud);
    removeAllChildElements(listDisplay);
    removeAllChildElements(audioStatsEl);
}

function updateMsgContainer(msg, includeIcon, keepContent) {
    if (lastLoadedMsg === msg && keepContent) { // already loaded message and keep content
        return;
    }
    let contents = msg;
    if (includeIcon) {
        let randIcon = random(spotistatsSplashIcons);
        contents += `\n\n${randIcon}`;
    }
    msgContainer.textContent = contents;
    lastLoadedMsg = msg;

    if (msg === '') {
        msgContainer.style.display = 'none';
    }
    else {
        msgContainer.style.display = 'block';
    }
}

function removeElement(element) {
    removeAllEventListeners(element);
  
    while (element.firstChild) {
      removeElement(element.firstChild);
      if (element.firstChild) {
        element.removeChild(element.firstChild);
      }
    }
  
    element.parentNode.removeChild(element);
  }

function removeAllChildElements(element) {
    while (element.firstChild) {
        removeElement(element.firstChild);
        if (element.firstChild) {
        element.removeChild(element.firstChild);
        }
    }
}

function removeAllEventListeners(element) {
    const eventTypes = ['click', 'mouseover', 'mouseout', 'keydown', 'keyup', 'submit'];
    eventTypes.forEach(type => {
      element.removeEventListener(type, () => {});
    });
}

function spotifyRetrieve(token, authEndpoint) {
    return fetch(authEndpoint, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(async (response) => {
        if (response.status === 200) {
            updateMsgContainer(loadingMsg, true, true);
            return response.json();
        } else if (response.status === 429) {
            const retryAfter = 5;
            console.log(`Rate limited. Retry after ${retryAfter} seconds.`);
            updateMsgContainer(rateLimitedMsg);
            await sleep(retryAfter * 1000);
            updateMsgContainer('')
            return spotifyRetrieve(token, authEndpoint);
        } else {
            throw new Error(`Failed to retrieve data. Status: ${response.status}`);
        }
    })
    .catch((error) => console.log("Error:", error));
}

async function getStats(time, data) {
    gettingStats = true;
    let res = null;
    let startingDate = null;
    let endDate = null;
    let timeMsg = '';
    if (!time) {
        updateMsgContainer('invalid time');
        return;
    }
    else if (time.season && time.year) {
        const seasonsToDates = {
            'spring': ['03-01', '05-31'],
            'summer': ['06-01', '08-31'],
            'fall': ['09-01', '11-30'],
            'winter': ['12-01', '02-29']
        }

        let startYear = time.year;
        let endYear = time.year;

        if (time.season === 'winter') {
            endYear = (++endYear).toString(); // since winter wraps across two years
        }

        startingDate = new Date(startYear + '-' + seasonsToDates[time.season][0] + ' '); // need to add space for utc time
        endDate = new Date(endYear + '-' + seasonsToDates[time.season][1] + ' ');

        if (time.season === 'winter') {
            timeMsg = `in the winter of '${startYear.slice(-2)}-${endYear.slice(-2)}`;
        }
        else {
            timeMsg = `in the ${time.season} of '${startYear.slice(-2)}`; // ex. in the fall of '07
        }
    }
    else if (time.startingDate && time.endDate) {
        startingDate = time.startingDate;
        endDate = time.endDate;
        if (startingDate === endDate) {
            timeMsg = `on ${startingDate.toDateString()}`;
        }
        else if (endDate >= new Date()) {
            timeMsg = `since ${startingDate.toDateString()}`;
        }
        else {
            timeMsg = `from ${startingDate.toDateString()} to ${endDate.toDateString()}`
        }
    }

    if (gotStats) {
        resetStatsDisplay();
    } 
    if (data && data.songData && data.audioData) {
        const sampleSongData = data.songData;
        const sampleAudioData = data.audioData;
        res = await finalizeNewSongs(sampleSongData, startingDate, endDate, sampleAudioData);
    }
    else {
        let userData = await spotifyRetrieve(token, 'https://api.spotify.com/v1/me');
        let userID = userData.id;
        let allPlaylists = [];
        let offset = 0;
        let nextPage = null;
        do {
            let playlistData = await spotifyRetrieve(token, `https://api.spotify.com/v1/me/playlists/?offset=${offset}&limit=50`);
            let retrievedPlaylists = playlistData.items;
            if (retrievedPlaylists.length > 0) {
                allPlaylists = allPlaylists.concat(retrievedPlaylists);
            }
            nextPage = playlistData.next;
            offset += 50;
        }
        while (nextPage !== null);
        
        let myPlaylists = allPlaylists.filter( (playlist) => {
            return playlist.owner.id === userID;
        });

        res = await getNewSongs(myPlaylists, startingDate, endDate);
    }
    
    if (res && res.newSongsFinal.length > 0 && res.audioStats) {
        gotStats = true;
        updateMsgContainer('');
        statsEl.style.display = 'block';

        if (res.newSongsFinal.length === 1) {
            numSongsAddedEl.textContent = `${timeMsg}, you added 1 new song`;
        }
        else {
            numSongsAddedEl.textContent = `${timeMsg}, you added ${res.newSongsFinal.length} new songs`;
        }

        hrsAddedEl.textContent = `listening to all of them would take ${res.hrsAdded} hours or ${res.hrsMadeFun}!`
        res.funStat.displayStats();

        createCloud(randomMultiple(res.newSongsFinal, 40));
        createListDisplay(res.newSongsFinal);
        if (songsDisplayTypeEl.value === 'display as list') {
            cloud.style.display = 'none';
            typeSongsConsec();      
        }
        else {
            cloud.style.display = 'block';
        }

        for (let statName in res.audioStats) {
            res.audioStats[statName].displayStats();
        }
        gettingStats = false;
    }
    else {
        updateMsgContainer(`${noNewSongsMsg} ${timeMsg}`, true);
        gettingStats = false;
    }
}

async function getNewSongs(myPlaylists, startingDate, endDate) {
    let newSongs = {};

    // do the api stuff
    let promises = myPlaylists.map(async (playlist) => {
        let offset = 0;
        let nextPage;

        do {
            let data = await spotifyRetrieve(token, `https://api.spotify.com/v1/playlists/${playlist.id}/tracks?offset=${offset}&limit=50`);

            let retrievedSongs = data.items;
            retrievedSongs.forEach((song) => {
                let id = song.track.id;

                if (!song.added_at) { // some songs added very long time ago have null added_at attribute
                    console.log('unknown date when added:');
                    console.log('Song: ' + song.track.name);
                    console.log('Playlist: ' + playlist.name);
                    return;
                }
                let addedDate = new Date(song.added_at.split('T')[0] + ' '); // add space to convert to utc

                if (addedDate < startingDate) { // If newly added song was (gasp) added before, mark it!! (to be removed in finalizeNewSongs)
                    newSongs[id] = null; // Unfortunately, however, doesn't take into account same song but released under different albums.
                }
                else if (addedDate <= endDate)  { // found earlier time when added song or new song
                    newSongs[id] = song;
                }
            });

            nextPage = data.next;
            offset += 50;
        } while (nextPage !== null);
    });

    await Promise.all(promises);

    let res = await finalizeNewSongs(newSongs, startingDate, endDate);
    return res;
}

function sleep(interval) {
    return new Promise(resolve => setTimeout(resolve, interval));
}

function sameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

function finalizeNewSongs(newSongs, startingDate, endDate, audioData) {
    return new Promise(async (resolve, reject) => {
        try {        
            let partialRes = null;
        
            if (newSongs instanceof Array && startingDate && endDate) {
                partialRes = await getFinalSongsFromSample(newSongs, startingDate, endDate, audioData);
            }
            else if (newSongs.constructor == Object) {
                partialRes = await getFinalSongsFromRetrieved(newSongs);
            }
            else {
                console.error('error: invalid inputs');
                return null;
            }
            let secAdded = partialRes.secAdded;
            let newSongsFinal = partialRes.newSongsFinal;
            let audioStats = partialRes.audioStats;
            let funStat = partialRes.funStat;

            let hrsAdded = round(secAdded / 3600);
            let hrsMadeFun = makeHrsFun(secAdded / 3600);
    
            let res = {newSongsFinal, hrsAdded, hrsMadeFun, audioStats, funStat};
            resolve(res);
        } catch (error) {
            reject(error);
        }
    });
}

function generateFunStat() {
    let possibleFunCtions = [
        ['% songs added on ', isAddedOnDay],
        ['% songs that start with ', songStartsWith],
        ['% songs made by Taylor Swift', isTSwift],
        ['% explicit songs', isExplicit],
        ['% songs that are ', isPopularityLvl]
    ];
    let funCtionData = random(possibleFunCtions);
    let funStatMsg = funCtionData[0]; // build beginning of fun stat
    let funCtion = funCtionData[1];
    let funParam = null; // 2nd parameter required in some funCtions
    
    if (funCtion === isAddedOnDay) {
        funParam = Math.floor(Math.random() * 6);
        funStatMsg += dayOfWeekAsString(funParam);
    }
    else if (funCtion === songStartsWith) {
        let letters = 'abcdefghijklmnopqrstuvwxyz';
        funParam = letters[Math.floor(Math.random() * 26)];
        funStatMsg += `'${funParam}'`;
    }
    else if (funCtion === isPopularityLvl) {
       let popularityLvls = [
        ['not popular at all (popularity = 0)', 0],
        ['kind of popular (popularity = 60-70)', [60, 70]],
        ['decently popular (popularity = 80-90)', [80, 90]],
        ['the most popular (popularity = 100)', 100],
       ];
       let selectedPopularityLvlData = random(popularityLvls);
       funParam = selectedPopularityLvlData[1];
       funStatMsg += selectedPopularityLvlData[0];
    }

    return {funStatMsg, funCtion, funParam};
}

function round(num) { // round to 3 dec places, if still 0 round to three sig figs
    if (typeof num !== 'number' || num === 0) { 
        return num;
    }
    else {
        let rounded = parseFloat(num.toFixed(3)); // since toFixed returns string value
        if (rounded === 0) {
            rounded = num.toPrecision(3);
        }
        return rounded;
    }
}

function getFinalSongsFromSample(newSongs, startingDate, endDate, audioData) {
    return new Promise(async (resolve, reject) => {
        let secAdded = 0;
        let newSongsFinal = [];
        let funStatParams = generateFunStat();
        let funStat = new SongAnalytics('fun stat', 'identify', funStatParams);
        let newAudioData = [];
        try {
            for (let i = 0; i < newSongs.length; i++) {
                let song = newSongs[i];
                let addedDate = new Date(song.added_at.split('T')[0] + ' '); // add space to convert to utc
                if (addedDate >= startingDate && addedDate <= endDate) {
                    newSongsFinal.push(song);
                    secAdded += song.track.duration_ms / 1000;
                    newAudioData.push(audioData[i]);

                    let name = song.track.name;
                    let link = song.track.external_urls.spotify || null;
                    funStat.addSongData(name, link, song);
                }
            }
            let audioStats = await analyzeAudioData(newSongsFinal, newAudioData);
            resolve({secAdded, newSongsFinal, funStat, audioStats});
        } catch (error) {
            reject(error);
        }
    });
}

function getFinalSongsFromRetrieved(newSongs) {
    return new Promise(async (resolve, reject) => {
        let secAdded = 0;
        let newSongsFinal = [];
        let funStatParams = generateFunStat();
        let funStat = new SongAnalytics('fun stat', 'identify', funStatParams);
        try {
            for (var key in newSongs) {
                if (newSongs.hasOwnProperty(key) && newSongs[key]) {
                    let song = newSongs[key];
                    newSongsFinal.push(song);
                    secAdded += song.track.duration_ms / 1000;
                    
                    let name = song.track.name;
                    let link = song.track.external_urls.spotify || null;
                    funStat.addSongData(name, link, song);
                }
            }
            let newAudioData = await getAudioData(newSongsFinal);
            let audioStats = await analyzeAudioData(newSongsFinal, newAudioData);
            let partialRes = {secAdded, newSongsFinal, funStat, audioStats};
            resolve(partialRes);
        } catch (error) {
            reject(error);
        }
    });
}

function getAudioData(songs) {
    return new Promise(async (resolve, reject) => {
        try {
            if (songs.length === 0) {
                resolve(null);
            }
            let songsLeft = [...songs]; // since js passes array as reference... don't want to splice original array!
            let audioData = [];
            let maxChunkLength = 100;
            while (songsLeft.length > 0) {
                let chunkedSongs = songsLeft.splice(0, maxChunkLength);
                let ids = chunkedSongs.map(song => song.track.id);
                let chunkedAudioData = await spotifyRetrieve(token, `https://api.spotify.com/v1/audio-features?ids=${ids.join(",")}`);
                audioData = audioData.concat(chunkedAudioData.audio_features);
            }
            resolve(audioData);
        } catch (error) {
            reject(error);
        }
    });
}

function analyzeAudioData(songs, audioData) {
    return new Promise(async (resolve, reject) => {
        try {
            // value based
            let danceability = new SongAnalytics('danceability');
            let energy = new SongAnalytics('energy');
            let instrumentalness = new SongAnalytics('instrumentalness');
            let loudness = new SongAnalytics('loudness', 'range', {minVal: -60, maxVal: 0, units: 'dB'});
            let speechiness = new SongAnalytics('speechiness');
            let tempo = new SongAnalytics('tempo', 'range', {maxVal: 300, units: 'BPM'});
            let valence = new SongAnalytics('valence');
        
            // frequency based
            let keyIndex = ['C', 'C♯, D♭', 'D', 'D♯, E♭', 'E', 'F', 'F♯, G♭', 'G', 'G♯, A♭', 'A', 'A♯, B♭', 'B'];
            let key = new SongAnalytics('key', 'count', {key: keyIndex, exclude: -1});
            let timeSignature = new SongAnalytics('time signature', 'count');
            
            if (songs.length === 0) {
                resolve(null);
            }

            for (let i = 0; i < songs.length; i++) {
                let data = audioData[i];
                if (!data) {
                    continue;
                }
        
                let name = songs[i].track.name;
                let link = songs[i].track.external_urls.spotify || null;
        
                // value counts
                danceability.addSongData(name, link, data.danceability);
                energy.addSongData(name, link, data.energy);
                instrumentalness.addSongData(name, link, data.instrumentalness);
                loudness.addSongData(name, link, data.loudness);
                speechiness.addSongData(name, link, data.speechiness);
                tempo.addSongData(name, link, data.tempo);
                valence.addSongData(name, link, data.valence);
        
                // key freqs
                key.addSongData(name, link, data.key);
                
                // time signature freqs
                timeSignature.addSongData(name, link, data.time_signature);
            };
        
            let audioStats = {
                danceability,
                energy,
                instrumentalness,
                loudness,
                speechiness,
                tempo,
                valence,
                key,
                timeSignature
            };
            resolve(audioStats);
        } catch (error) {
            reject(error);
        }
    });
}

class SongAnalytics {
    constructor(name, type, params) {
        this.name = name;
        this.type = type || 'range';
        if (!params) params = {};

        if (this.type === 'range') {
            this.numCohorts = params.numCohorts || 5;
            this.minVal = params.minVal || 0;
            this.maxVal = params.maxVal || 1;
            if (this.numCohorts === 5) {
                this.qualifierIndex = ['very low', 'pretty low', 'moderate', 'pretty high', 'very high'];
            }
            this.units = params.units || '';
            
            this.freqs = this.buildFreqs(this.numCohorts, this.minVal, this.maxVal);

            this.minSong = {
                names: [],
                val: Infinity
            };
    
            this.maxSong = {
                names: [],
                val: - Infinity
            };
    
            this.sumVals = 0;
            this.avgVal = 0;

            this.addSongData = this.addSongDataRange;
            this.createMostFreqMsg = this.createMostFreqMsgRange;
            this.displayStats = this.displayStatsRange;
        }
        else if (type === 'count') {
            this.key = params.key; // if number needs to be converted to a more comprehensible category (ex. numbers to key signatures)
            this.freqs = {};
            this.exclude = params.exclude;
            this.addSongData = this.addSongDataCount;
            this.createMostFreqMsg = this.createMostFreqMsgCount;
            this.createLeastFreqMsg = this.createLeastFreqMsgCount;
            this.createAvgMsg = function() {return 'error, average cannot be found for SongAnalytics of count type';};
            this.displayStats = this.displayStatsCount;
        }
        else if (type === 'identify') {
            this.funStatMsg = params.funStatMsg;
            this.funCtion = params.funCtion;
            this.funParam = params.funParam;
            this.songs = [];
            this.numSongsAll = 0; // all songs ran through funCtion, regardless if they pass as a fun song or not
            this.addSongData = this.addSongDataIdentify;
            this.createAvgMsg = function() {return 'error, average cannot be found for SongAnalytics of identify type';};
            this.displayStats = this.displayStatsIdentify;
        }

        this.numSongs = 0;
    }

    buildFreqs(numCohorts, minVal, maxVal) {
        let freqs = [];
        let cohortSize = (maxVal - minVal) / numCohorts; 
        let curStartBound = minVal;
        for (let i = 0; i < numCohorts; i++) {
            let freq = { // a value in a cohort would fall into the range [startBound, endBound)
                startBound: round(curStartBound), // round to remove floating pt imprecision
                endBound: round(curStartBound + cohortSize),
                songs: [],
                count: 0
            };
            if (this.qualifierIndex) {
                freq.qualifier = this.qualifierIndex[i];
            }
            freqs.push(freq);
            curStartBound += cohortSize;
        };
        return freqs;
    }

    addSongDataRange(name, link, val) {
        if (!name || !val) {
            return;
        }
        let songInfo = {name, link};
        // find cohort
        for (let i = 0; i < this.numCohorts; i++) {
            let cohort = this.freqs[i];
            if (val >= cohort.startBound && val < cohort.endBound) {
                cohort.count++;
                cohort.songs.push(songInfo);
                break;
            }
        };
        // update song with min/max value
        
        if (val < this.minSong.val) {
            this.minSong.songs = [songInfo];
            this.minSong.val = val;
        }
        else if (val == this.minSong.val) {
            this.minSong.songs.push(songInfo);
        }

        if (val > this.maxSong.val) {
            this.maxSong.songs = [songInfo];
            this.maxSong.val = val;
        }
        else if (val == this.maxSong.val) {
            this.maxSong.songs.push(songInfo);
        }

        this.numSongs++;
        this.sumVals += val;
        this.avgVal = round(this.sumVals / this.numSongs);
    }

    addSongDataCount(name, link, val) {
        let songData = {name, link};
        if (!name || !val || this.exclude && val === this.exclude) { // invalid song data, don't record
            return;
        }
        let category = (this.key) ? this.key[val] : val;
        if(this.freqs[category] === undefined) {
            this.freqs[category] = {
                songs: [],
                count: 0
            };
        }
        this.freqs[category].songs.push(songData);
        this.freqs[category].count ++;
        this.numSongs++;
    }

    addSongDataIdentify(name, link, allData) {
        let songData = {name, link};
        if (!name || !allData) {
            return;
        }
        if (this.funParam) {
            if (this.funCtion(allData, this.funParam)) {
                this.songs.push(songData);
                this.numSongs++;
            }
        }
        else {
            if (this.funCtion(allData)) {
                this.songs.push(songData);
                this.numSongs++;
            }
        }
        
        this.numSongsAll++;
    }

    addUnits(val) {
        if (this.units) {
            val += ' ' + this.units; 
        }
        return val;
    }

    findMostFreq() {
        let mostFreq = null;
        if (this.type === 'range') {
            mostFreq = this.freqs.reduce(function(prev, current) {
                return (prev && prev.count > current.count) ? prev : current
            }); // outputs category {songs, count, startBound, endBound, qualifier}
        }
        else if (this.type === 'count') { // convert count freqs (object) to array
            let freqsToArray = Object.entries(this.freqs);
            mostFreq = freqsToArray.reduce(function(prev, current) {
                return (prev && prev[1].count > current[1].count) ? prev : current
            }); // outputs ["category", {songs, count}]
        }
        return mostFreq;
    }

    findLeastFreq() {
        let leastFreq = null;
        if (this.type === 'range') {
            leastFreq = this.freqs.reduce(function(prev, current) {
                return (prev && prev.count < current.count) ? prev : current
            }); // outputs category {songs, count, startBound, endBound, qualifier}
        }
        else if (this.type === 'count') { // convert count freqs (object) to array
            let freqsToArray = Object.entries(this.freqs);
            leastFreq = freqsToArray.reduce(function(prev, current) {
                return (prev && prev[1].count < current[1].count) ? prev : current
            }); // outputs ["category", {songs, count}]
        }
        return leastFreq;
    }

    createMostFreqMsgRange() {
        let mostFreqData = this.findMostFreq();
        let percent = round(mostFreqData.count / this.numSongs * 100);
        if (this.qualifierIndex) {
            return (`most frequent range: ${mostFreqData.qualifier} (${mostFreqData.startBound} to ${this.addUnits(mostFreqData.endBound)}), which makes up ${percent}% of newly added songs`);
        }
        else {
            return (`most frequent range: ${mostFreqData.startBound} to ${this.addUnits(mostFreqData.endBound)}`);
        }
    }

    createMostFreqMsgCount() {
        let mostFreqData = this.findMostFreq();
        let percent = round(mostFreqData[1].count / this.numSongs * 100);
        return (` ${this.name} of ${mostFreqData[0]}, which makes up ${percent}% of newly added songs`);
    }

    createLeastFreqMsgCount() {
        let leastFreqData = this.findLeastFreq();
        let percent = round(leastFreqData[1].count / this.numSongs * 100);
        return (`least frequent ${this.name} is ${leastFreqData[0]}, which makes up ${percent}% of newly added songs`);
    }

    createAvgMsg() { // for range type only
        let scaleMsg = `(on a scale of ${this.minVal} to ${this.addUnits(this.maxVal)})`;
        let qualifier = '';
        if (this.qualifierIndex) {
            for (let i = 0; i < this.numCohorts; i++) {
                let cohort = this.freqs[i];
                if (this.avgVal >= cohort.startBound && this.avgVal < cohort.endBound) {
                    qualifier = cohort.qualifier;
                }
            };
            return `${qualifier} ${this.name}: average of ${this.addUnits(this.avgVal)} ${scaleMsg}`; 
        }
        else {
            return `${this.name}: average of ${this.avgVal} ${scaleMsg}`; 
        }
    }

    createIdentifyMsg() {
        let funPercentage = round(this.numSongs / this.numSongsAll * 100);
        return `${this.funStatMsg}: ${funPercentage}%`;
    }

    getSomeSongs(songs, max) {
        let someSongs = [];
        if (!max) {
            var max = 10;
        }
        for (let i = 0; i < songs.length; i++) {
            let randIndex = randomIndex(songs);
            someSongs.push(songs[randIndex]);
            songs.splice(randIndex, 1);
            if (i === max - 1) {
                break;
            }
        }
        return someSongs;
    }

    displaySongsAsLinks(songs, parentEl) {
        if (!songs || !parentEl) {
            return;
        }
        songs.forEach((song) => {
            let songDisplay = document.createElement('a');
            songDisplay.textContent = song.name;
            songDisplay.setAttribute('songName', song.name);
            songDisplay.classList.add('song-display');
            
            let trackUrl = song.link; // url to track
            if (trackUrl) {
                songDisplay.href = trackUrl;
            }
    
            parentEl.appendChild(songDisplay);
        });
    }
    
    createDropdown() {
        let dropdown = document.createElement("BUTTON");
        dropdown.textContent = '▲';
        dropdown.toggled = false;
        dropdown.classList.add('spotistats-dropdown');
        dropdown.classList.add('no-spacing-vertical');
        dropdown.addEventListener('click', function() {
            this.classList.toggle('active');
            this.toggled = !this.toggled;
            let extraInfo = this.parentElement.getElementsByClassName('extra-info')[0];
            if (this.toggled) {
                extraInfo.style.display = 'block';
                this.textContent = '▼';
            }
            else {
                extraInfo.style.display = 'none';
                this.textContent = '▲';
            }
        });
        return dropdown;
    }
    
    displayStatsRange() {
        let avgEl = document.createElement('li');
        avgEl.textContent = this.createAvgMsg();

        let dropdown = this.createDropdown();
        
        let extraInfo = document.createElement('ul');
        extraInfo.classList.add('extra-info');
        extraInfo.classList.add('no-spacing-bottom');
        extraInfo.style.display = 'none';
        let mostFreqEl = document.createElement('li');
        mostFreqEl.textContent = this.createMostFreqMsg();
        let maxSongEl = document.createElement('li');
        let minSongEl = document.createElement('li');
        maxSongEl.textContent = `highest ${this.name} (${this.addUnits(this.maxSong.val)}): `;
        this.displaySongsAsLinks(this.maxSong.songs, maxSongEl);
        minSongEl.textContent = `lowest ${this.name} (${this.addUnits(this.minSong.val)}): `;
        this.displaySongsAsLinks(this.minSong.songs, minSongEl);

        extraInfo.appendChild(mostFreqEl);
        extraInfo.appendChild(maxSongEl);
        extraInfo.appendChild(minSongEl);

        avgEl.appendChild(dropdown);
        avgEl.appendChild(extraInfo);
        
        audioStatsEl.appendChild(avgEl);
    }

    displayStatsCount() {
        let mostFreqEl = document.createElement('li');
        mostFreqEl.textContent = this.createMostFreqMsg();

        let dropdown = this.createDropdown();

        let extraInfo = document.createElement('ul');
        extraInfo.classList.add('extra-info');
        extraInfo.classList.add('no-spacing-bottom');
        extraInfo.style.display = 'none';

        let mostFreqSongsEl = document.createElement('li');
        mostFreqSongsEl.textContent = 'includes ';
        let mostFreqData= this.findMostFreq();
        let someMostFreqSongs = this.getSomeSongs(mostFreqData[1].songs);
        this.displaySongsAsLinks(someMostFreqSongs, mostFreqSongsEl);

        let leastFreqSongsEl = document.createElement('li');
        leastFreqSongsEl.textContent = this.createLeastFreqMsg() + ', including';
        let leastFreqData = this.findLeastFreq();
        let someLeastFreqSongs = this.getSomeSongs(leastFreqData[1].songs);
        this.displaySongsAsLinks(someLeastFreqSongs, leastFreqSongsEl);

        extraInfo.appendChild(mostFreqSongsEl);
        extraInfo.appendChild(leastFreqSongsEl);
        mostFreqEl.appendChild(dropdown);
        mostFreqEl.appendChild(extraInfo);

        audioStatsEl.appendChild(mostFreqEl);
    }

    displayStatsIdentify() {
        funStatEl.textContent = this.createIdentifyMsg();

        if (this.numSongs === 0) {
            return;
        }

        let dropdown = this.createDropdown();

        let extraInfo = document.createElement('ul');
        extraInfo.classList.add('extra-info');
        extraInfo.classList.add('no-spacing-bottom');
        extraInfo.style.display = 'none';

        let funSongsEl = document.createElement('li');
        funSongsEl.textContent = 'includes ';
        let someFunSongs = this.getSomeSongs(this.songs);
        this.displaySongsAsLinks(someFunSongs, funSongsEl);

        extraInfo.appendChild(funSongsEl);
        funStatEl.appendChild(dropdown);
        funStatEl.appendChild(extraInfo);
    }
}

function makeHrsFun(hrs) {
     // number provided in array * hrs = fun metric
    let funHrConversions = [
        [4, 'cat naps'], // 1 cat nap = 15 min
        [36, 'Minneapolis traffic light cycles'], // 1 Minneapolis traffic light cycle = 100 sec https://www.cbsnews.com/minnesota/news/how-are-traffic-lights-timed/
        [5, 'breakfasts'], // 1 avg American breakfast = 12 minutes https://www.wsj.com/articles/BL-263B-1517 
        [1/384, 'Mars trips'], // 1 Mars trip = 384 hrs https://www.space.com/24701-how-long-does-it-take-to-get-to-mars.html
        [1/336, 'fortnights'], // 1 fortnight = 14 days
        [0.15, 'miles covered by a sloth'], // Sloth = 0.15 mph https://www.infoplease.com/math-science/biology/plants-animals/speed-of-animals
        [144, 'espressos'], // 1 espresso = 20-30 sec, I'll round it to 25 sec https://www.ncausa.org/about-coffee/how-to-brew-coffee
        [1.08 * Math.pow(10, 28), 'jiffies'], // 1 jiffy = 3×10−24 sec
        [1140.68441065, 'nanocenturies'], // 1 nanocentury = 3.156 sec
        [0.04178074623, 'sidereal days'] // 1 sidereal day = 86164.0905 sec
        // add more from here https://en.wikipedia.org/wiki/List_of_unusual_units_of_measurement#Time
    ];
    let conversion = random(funHrConversions);
    return `${round(hrs * conversion[0])} ${conversion[1]}`;
}

function dayOfWeekAsString(i) {
    let daysOfWeek = ["Sunday", "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    return daysOfWeek[i];
}

function isAddedOnDay(song, day) { // day has to be a number 0 - 6. date needs to have time component, otherwise will evaluate as the day before for some annoying reason
    return new Date(song.added_at).getDay() === day;
}

function songStartsWith(song, letter) { // letter is lowercase (a-z)
    return song.track.name.toLowerCase().startsWith(letter);
}

function isTSwift(song) {
    let artists = song.track.artists;
    if (artists) {
        for (let i = 0; i < artists.length; i++) {
            if (artists[i].name === 'Taylor Swift') {
                return true;
            }
        }
    }
    return false;
}

function isExplicit(song) {
    return song.track.explicit;
}

function isPopularityLvl(song, popularityLvl) {
    let p = song.track.popularity

    if (typeof popularityLvl === 'number') {
        return p === popularityLvl;
    }
    else if (popularityLvl instanceof Array && popularityLvl.length === 2) {
        let min = popularityLvl[0];
        let max = popularityLvl[1];
        return p >= min && p <= max;
    }
    else {
        console.error('Error, popularityLvl is incorrectly formatted', popularityLvl);
        return null;
    }
}


function createCloud(songs) {
    songs.forEach((song) => {
        if (!song.track.album.images || !song.track.album.images[0] || !song.track.external_urls) {
            return;
        }

        let imgUrl = song.track.album.images[0].url; // song cover
        let trackUrl = song.track.external_urls.spotify; // url to track
        let name = song.track.name;
        if (imgUrl && trackUrl) {
            particles.push(new Particle(imgUrl, trackUrl, name, cloudContainerWidth, cloudContainerHeight));
        }
    })

    updateParticles();
}

function updateParticles() {
    particles.forEach((particle) => {
        particle.update();
    });

    requestAnimationFrame(updateParticles);
}

class Particle {
    constructor(imgSrc, link, name, containerWidth, containerHeight) {
        this.element = document.createElement('div');
        this.element.classList.add('cloud-image-container');

        this.hoverText = document.createElement('span');
        this.hoverText.textContent = name;
        this.hoverText.classList.add('cloud-hover-text');
        this.element.appendChild(this.hoverText);

        this.image = document.createElement('img');
        this.image.src = imgSrc;
        this.image.style.width = `${40 + Math.random() * 50}px`;
        this.element.appendChild(this.image);

        this.link = link;

        this.containerWidth = containerWidth;
        this.containerHeight = containerHeight;

        const radius = Math.min(containerWidth, containerHeight) / 2;
        const theta = Math.random() * Math.PI * 2; // angle around sphere
        const phi = Math.random() * Math.PI; // angle from top to bottom

        this.position = { // spherical coords -> Cartesian coords
            x: containerWidth / 2 + radius * Math.sin(phi) * Math.cos(theta),
            y: containerHeight / 2 + radius * Math.cos(phi),
            z: radius * Math.sin(phi) * Math.sin(theta)
        };

        this.velocity = {
            x: Math.random() * 2 - 1,
            y: Math.random() * 2 - 1,
            z: Math.random() * 2 - 1
        };
        this.acceleration = {
            x: Math.random() * 0.02 - 0.01,
            y: Math.random() * 0.02 - 0.01,
            z: Math.random() * 0.02 - 0.01
        };

        // link to track
        this.element.addEventListener('click', () => {
            if (this.link) {
                window.open(this.link, '_blank');
            }
        });

        cloud.appendChild(this.element);
    }

    update() {
        this.velocity.x += this.acceleration.x;
        this.velocity.y += this.acceleration.y;
        this.velocity.z += this.acceleration.z;
        
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        this.position.z += this.velocity.z;
        // bounce back if hit edges of cloud container
        if (this.position.x < 0 || this.position.x > this.containerWidth) {
            this.velocity.x *= -1;
        }
        if (this.position.y < 0 || this.position.y > this.containerHeight) {
            this.velocity.y *= -1;
        }
        if (this.position.z < 0 || this.position.z > this.containerWidth) {
            this.velocity.z *= -1;
        }
        this.element.style.transform = `translate3d(${this.position.x}px, ${this.position.y}px, ${this.position.z}px)`;

        
    }
}

function createListDisplay(songs) {
    songs.forEach((song) => {
        let songDisplay = document.createElement('a');
        songDisplay.setAttribute('songName', song.track.name);
        songDisplay.classList.add('song-display');
        
        let trackUrl = song.track.external_urls.spotify; // url to track
        if (trackUrl) {
            songDisplay.href = trackUrl;
        }

        listDisplay.appendChild(songDisplay);
    });
}

async function typeSongsConsec() {
    let newSongEls = document.getElementsByClassName('song-display');
    listDisplay.style.display = 'block';
    cloud.style.display = 'none';

    let myTypingId = ++curTypingId;

    for (let i = 0; i < newSongEls.length; i++) {
        let el = newSongEls[i];
        el.textContent = '';
    }
    for (let i = 0; i < newSongEls.length; i++) {
        let el = newSongEls[i];
        let name = el.getAttribute('songName');
        for (let c of name) {
            if (curTypingId !== myTypingId) {
                console.log('stop typing this instance', myTypingId);
                return;
            }
            el.innerHTML += c;
            await sleep(1);
        }
    }
}
