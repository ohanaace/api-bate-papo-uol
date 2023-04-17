import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import dayjs from "dayjs"
import joi from "joi"

dotenv.config()
const mongoClient = new MongoClient(process.env.DATABASE_URL)
try {
    await mongoClient.connect()
} catch (error) {
    console.log(error.message)
}
const db = mongoClient.db()
const app = express()

app.use(cors())
app.use(express.json())

const time = dayjs().format("HH:mm:ss")

app.post("/participants", async (req, res) => {
    const { name } = req.body
    const participantSchema = joi.object({
        name: joi.string().required()
    })
    const newParticipant = { name }
    const validation = participantSchema.validate(newParticipant)
    if (validation.error) {
        const errMessages = validation.error.details.map((error) => error.message)
        return res.status(422).send(errMessages)
    }
    try {
        const loggedUser = await db.collection("participants").findOne({ name: name })
        if (loggedUser) return res.sendStatus(409)
        await db.collection("participants").insertOne({ name, lastStatus: Date.now() })
        await db.collection("messages").insertOne({ from: `${name}`, to: 'Todos', text: 'entra na sala...', type: 'status', time })
        res.sendStatus(201)
    }
    catch {
        err => res.status(500).send(err.message)
    }
})
app.get("/participants", async (req, res) => {
    const participants = await db.collection("participants").find().toArray()
    try {
        res.send(participants)
    } catch (error) {
        res.status(500).send(error.message)
    }
})

app.post("/messages", async (req, res) => {
    const { user } = req.headers
    const { to, text, type } = req.body

    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid("message", "private_message").required()

    })
    const userHeaderSchema = joi.object({
        from: joi.string().required()
    })
    const header = { from: user }
    const headerValidation = userHeaderSchema.validate(header)
    if (headerValidation.error) {
        const error = headerValidation.error.details.map(err => err.message)
        return res.status(422).send(error)
    }
    const message = { to, text, type }
    const validation = messageSchema.validate(message, { abortEarly: false })
    if (validation.error) {
        const error = validation.error.details.map(errors => errors.message)
        return res.status(422).send(error)
    }
    const authUser = await db.collection("participants").findOne({ name: user })
    try {
        if (!authUser) return res.status(422).send("Você não está logado! Faça login e tente novamente.")
        await db.collection("messages").insertOne({ from: user, ...message, time })
        res.sendStatus(201)
    } catch (error) {
        res.status(500).send(error.message)
    }
})
app.get("/messages", async (req, res) => {
    const { user } = req.headers
    const { limit } = req.query
    const userMessages = await db.collection("messages").find({ $or: [{ to: "Todos" }, { to: `${user}` }, { from: `${user}` }] }).toArray()
    try {
        if(limit === undefined) return res.send(userMessages)
        if (Number(limit) < 0 || Number(limit) === 0 || isNaN(limit)) return res.sendStatus(422)
        if (Number(limit)) return res.send(userMessages.slice(-limit))
    } catch (error) {
        res.status(500).send(error.message)
    }
})

app.post("/status", async (req, res) => {
    const { user } = req.headers

    if (!user) return res.sendStatus(404)
    const activeUser = await db.collection("participants").findOne({ name: user })
    try {
        if (!activeUser) return res.sendStatus(404)
        const newStatus = Date.now()
        await db.collection("participants").updateOne({ name: user }, { $set: { lastStatus: newStatus } })
        res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error.message)
    }
})


const PORT = 5000
app.listen(PORT)