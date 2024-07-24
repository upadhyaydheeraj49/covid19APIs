const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')

const app = express()
app.use(express.json())

let db = null;
const initializeDbAndServer = async () => {
  const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  })
  app.listen(3000, () => {
    console.log('Server Started')
  })
}
initializeDbAndServer()

app.post('/login/', async (request, response) => {
  const userDetails = request.body
  const {username, password} = userDetails

  const getUserQuery = `
            SELECT
                *
            FROM 
                user
            WHERE username = '${username}';
            `
  const dbUser = await db.get(getUserQuery)

  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordValid = await bcrypt.compare(password, dbUser.password)
    if (isPasswordValid) {
      //valid user
      const jwtToken = await jwt.sign({username}, 'secret_key')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

const authenticateToken = async (request, response, next) => {
  let jwtToken
  authHeader = request.headers['authentication']

  if (authHeader !== undefined) {
    //take out the token
    jwtToken = authHeader.split(' ')[1]
  }

  await jwt.verify(jwtToken, 'secret_key', (error, payload) => {
    if (error) {
      response.status(401)
      response.send('Invalid JWT Token')
    } else {
      next()
    }
  })
}

app.get('/states/', authenticateToken, async (request, response) => {
  const getStatesQuery = `
      SELECT 
          state_id AS stateId,
          state_name AS stateName,
          population
      FROM 
          state;
      `
  const statesList = await db.all(getStatesQuery)
  response.send(statesList)
})

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params

  const getStateQuery = `
      SELECT 
        state_id AS stateId,
        state_name AS stateName,
        population
      FROM 
        state
      WHERE state_id = ${stateId};
    `

  const stateData = await db.get(getStateQuery)
  response.send(stateData)
})

app.post('/districts/', authenticateToken, async (request, response) => {
  const districtDetails = request.body
  const {districtName, stateId, cases, cured, active, deaths} = districtDetails

  const addDistrictQuery = `
      INSERT INTO
        district(district_name, state_id, cases, cured, active, deaths)
      VALUES(
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
      );
      `

  await db.run(addDistrictQuery)
  response.send('District Successfully Added')
})

app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `
      SELECT
        district_id AS districtId,
        district_name AS districtName,
        state_id AS stateId,
        cases,
        cured,
        active,
        deaths
      FROM district
      WHERE district_id = ${districtId};
      `

    const district = await db.get(getDistrictQuery)
    response.send(district)
  },
)

app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params

    const deleteDistrictQuery = `
      DELETE
      FROM district
      WHERE district_id = ${districtId};
      `

    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const districtDetails = request.body

    const {districtName, stateId, cases, cured, active, deaths} =
      districtDetails

    const updateDistrictQuery = `
      UPDATE 
        district
      SET
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}

      WHERE district_id = ${districtId};
      `

    await db.run(updateDistrictQuery)
    response.send('District Successfully Updated')
  },
)

app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params

    const getStateStasQuery = `
        SELECT
          SUM(cases) AS totalCases,
          SUM(cured) AS totalCured,
          SUM(active) AS totalActive,
          SUM(deaths) AS totalDeaths
        FROM
          state INNER
          JOIN district ON state.state_id = district.state_id
        WHERE state.state_id = ${stateId};
        `
    const stateStats = await db.get(getStateStasQuery)
    response.send(stateStats)
  },
)

module.exports = app
