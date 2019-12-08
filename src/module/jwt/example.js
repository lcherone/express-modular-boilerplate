process.env.DEBUG = 'app:*'

const certsPath = path.join(__dirname, 'api', '.files', 'jwt') //?.

const jwt = require('@lib/jwt')({
    certsPath
});

/**
 * Sign
 */
const token = jwt.sign({
    id: 12345,
    role: 'user',
    foo: 'barbaz',
    iat: Math.floor(Date.now() / 1000) - 30 // backdate so 30 seconds left (for testing)
}, {
    algorithm: 'RS256',
    keyid: '1',
    noTimestamp: false,
    expiresIn: '60s'
}) //? $.substr(0, 50)+' ...snip'

/**
 * Decode
 */
let decoded = jwt.decode(token) //?.

decoded //?+

/**
 * Verify token (good / above)
 */
try {
    decoded = jwt.verify(token)

    decoded
} catch (e) {
    e //?
}

/**
 * Verify token (expired)
 */
try {
    decoded = jwt.verify(jwt.sign({
        id: 12345,
        role: 'user',
        foo: 'barbaz',
        iat: Math.floor(Date.now() / 1000) - 61 // backdate so 61 second (i.e expired)
    }, {
        algorithm: 'RS256',
        keyid: '1',
        noTimestamp: false,
        expiresIn: '60s' //? 'expires in '+$
    }))

    // never gets here
    decoded //?
} catch (e) {
    e.name //?
}
