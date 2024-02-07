// ty https://leemartin.dev/creating-a-simple-spotify-authorization-popup-in-javascript-7202ce86a02f
// and https://medium.com/front-end-weekly/how-i-built-a-miniature-year-round-available-version-of-spotify-wrapped-e7625a30b58b

const scope = 'user-read-private playlist-read-private playlist-read-collaborative';
const client_id = 'NOT-TELLING-YOU-GO-GET-YOUR-OWN';
const redirect_uri = window.location.origin + '/bites/spotistats.php'; // automatically redirect to localhost or home.sophli.me
const AUTHORIZATION_URL = 'https://accounts.spotify.com/authorize?' +
new URLSearchParams({
  response_type: 'token',
  client_id: client_id,
  scope: scope,
  redirect_uri: redirect_uri
})
+ 
'&'
;

const getStatsButton = document.getElementById('get-stats');
const getSampleStatsButton = document.getElementById('get-sample-stats')
const startingDateInput = document.getElementById('starting-date');
const statsEl = document.getElementById('stats');
const hrsAddedEl = document.getElementById('hrs-added');
const funStatEl = document.getElementById('fun-stat');
const songsDisplayTypeEl = document.getElementById('songs-display-type');

const msgContainer = document.getElementById('msg-container');
const rateLimitedMsg = `Uh oh, you're accessing the Spotify API too fast! Let's cool down a bit...`;
const noNewSongsMsg = 'No new songs added!';

const listDisplay = document.getElementById('list-display');
const cloud = document.getElementById('cloud');
const cloudContainerWidth = '400';
const cloudContainerHeight = '400';

const particles = [];

const token = window.location.hash.substring(1).split('&')[0].split("=")[1];
window.location.hash = '';

var gettingStats = false;
var gotStats = false;
var curTypingId = 0; // increment when want to stop typing

setup();

function setup() {
    startingDateInput.onchange = localStorage.setItem('spotistats-date', startingDateInput.value);
    setSavedDate();

    getStatsButton.addEventListener('click', function () {
        if (startingDateInput) {
            if (token) {
                const startingDate = new Date(startingDateInput.value);
                getStats(startingDate);  
            }
            else {
                window.location = AUTHORIZATION_URL;
            }
        }
    })
    
    getSampleStatsButton.addEventListener('click', function () {
        if (startingDateInput) {
            const startingDate = new Date(startingDateInput.value);
            getStats(startingDate, sampleSpotifyData);
        }
    })

    songsDisplayTypeEl.onchange = function() {
        if (songsDisplayTypeEl.value === 'list') {
            typeSongsConsec();      
        }
        else {
            cloud.style.display = 'block';
            listDisplay.style.display = 'none';           
        }
    }
}

function setSavedDate() {
    let savedDate = localStorage.getItem('spotistats-date');
    if (savedDate) {
        startingDateInput.value = savedDate;
    }
}

function resetStatsDisplay() {
    curTypingId++; // stop current typing if any
    msgContainer.textContent = '';
    statsEl.style.display = 'none';
    hrsAddedEl.textContent = '';
    funStatEl.textContent = '';
    removeAllChildElements(cloud);
    removeAllChildElements(listDisplay);
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
            return response.json();
        } else if (response.status === 429) {
            const retryAfter = 5;
            console.log(`Rate limited. Retry after ${retryAfter} seconds.`);
            msgContainer.textContent = rateLimitedMsg;
            await sleep(retryAfter * 1000);
            msgContainer.textContent = '';
            return spotifyRetrieve(token, authEndpoint);
        } else {
            throw new Error(`Failed to retrieve data. Status: ${response.status}`);
        }
    })
    .catch((error) => console.log("Error:", error));
}

async function getStats(startingDate, sampleSongData) {
    if (gettingStats) {
        return;
    }

    gettingStats = true;
    let res = null;
    if (gotStats) {
        resetStatsDisplay();
    } 
    if (sampleSongData) {
        res = finalizeNewSongs(sampleSongData, startingDate);
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

        res = await getNewSongs(myPlaylists, startingDate);
    }
    
    if (res && res.newSongsFinal.length > 0) {
        gotStats = true;

        statsEl.style.display = 'block';
        hrsAddedEl.textContent = `${res.hrsAdded} hours of new music added or ${res.hrsMadeFun}`
        funStatEl.textContent =  res.funStat;

        createCloud(randomMultiple(res.newSongsFinal, 40));
        createListDisplay(res.newSongsFinal);
        if (songsDisplayTypeEl.value === 'list') {
            typeSongsConsec();      
        }

        gettingStats = false;
    }
    else {
        msgContainer.textContent = noNewSongsMsg;
    }
}

async function getNewSongs(myPlaylists, startingDate) {
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
                let addedDate = new Date(song.added_at.split('T')[0]);

                if (addedDate < startingDate) { // If newly added song was (gasp) added before, mark it!! (to be ignored later)
                    newSongs[id] = null; // Unfortunately, however, doesn't take into account same song but released under different albums.
                }
                else if (newSongs[id] === undefined) { // if newly added and not marked as old song
                    newSongs[id] = song;
                }
            });

            nextPage = data.next;
            offset += 50;
        } while (nextPage !== null);
    });

    await Promise.all(promises);

    return finalizeNewSongs(newSongs);
}

function sleep(interval) {
    return new Promise(resolve => setTimeout(resolve, interval));
}

function finalizeNewSongs(newSongs, startingDate) {
    let newSongsFinal = [];
    let secAdded = 0;

    let possibleFunCtions = [
        ['% songs added on ', isAddedOnDay],
        ['% songs that start with ', songStartsWith],
        ['% songs made by Taylor Swift', isTSwift],
        ['% explicit songs', isExplicit],
        ['% songs that are ', isPopularityLvl]
    ];
    let funCtionData = random(possibleFunCtions);
    let funStat = funCtionData[0]; // build beginning of fun stat
    let funCtion = funCtionData[1];
    let funSongs = [];
    let funParam = null; // 2nd parameter required in some funCtions
    
    if (funCtion === isAddedOnDay) {
        funParam = Math.floor(Math.random() * 6);
        funStat += dayOfWeekAsString(funParam);
    }
    else if (funCtion === songStartsWith) {
        let letters = 'abcdefghijklmnopqrstuvwxyz';
        funParam = letters[Math.floor(Math.random() * 26)];
        funStat += `'${funParam}'`;
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
       funStat += selectedPopularityLvlData[0];
    }
    
    funStat += ': ';

    if (newSongs.constructor == Object) { // is dict? remove null vals + add new song data to array
        for (var key in newSongs) {
            if (newSongs.hasOwnProperty(key) && newSongs[key]) {
                let song = newSongs[key];
                newSongsFinal.push(song);
                secAdded += song.track.duration_ms / 1000;
        
                if (funParam === null) { // if no param needed besides the song data
                    if (funCtion(song)) {
                        funSongs.push(song);
                    }
                }
                else {
                    if (funCtion(song, funParam)) {
                        funSongs.push(song);
                    }
                }
            }
        }
    }
    else if (newSongs instanceof Array && startingDate) { // is list? (i.e. new songs already sorted out, solely for TESTING DISPLAY)
        newSongs.forEach((song) => {
            let addedDate = new Date(song.added_at.split('T')[0]);
            if (addedDate >= startingDate) {
                newSongsFinal.push(song);
                secAdded += song.track.duration_ms / 1000;
        
                if (funParam === null) { // if no param needed besides the song data
                    if (funCtion(song)) {
                        funSongs.push(song);
                    }
                }
                else {
                    if (funCtion(song, funParam)) {
                        funSongs.push(song);
                    }
                }   
            }
        });
    }

    let hrsAdded = round(secAdded / 3600);
    let hrsMadeFun = makeHrsFun(secAdded / 3600);
    let funPercentage = round(funSongs.length / newSongsFinal.length * 100);
    funStat += funPercentage + '%';

    return { newSongsFinal, hrsAdded , hrsMadeFun , funStat};
}

function random(array) {
    if (array instanceof Array) {
        return array[(Math.floor(Math.random() * array.length))];
    }
    else {
        console.log('not an array silly billy');
        return null;
    }
}

function randomMultiple(array, n) {
    if (array instanceof Array) {
        const shuffled = array.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, n);
    }
    else {
        console.log('not an array silly billy');
        return null;
    }
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
