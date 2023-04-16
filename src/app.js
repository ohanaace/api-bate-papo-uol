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

const hour = dayjs().hour()
const minute = dayjs().minute()
const second = dayjs().second()

app.post("/participants", async (req, res) => {
    const { name } = req.body
    const participantSchema = joi.object({
        name: joi.string().required()
    })
    const newParticipant = {name}
    const validation = participantSchema.validate(newParticipant)
    if (validation.error) {
        const errMessages = validation.error.details.map((error) => error.message)
        return res.status(422).send(errMessages)
    }
    try {
        const loggedUser = await db.collection("participants").findOne({ name: name })
        if (loggedUser) return res.sendStatus(409)
        await db.collection("participants").insertOne({ name, lastStatus: Date.now() })
        await db.collection("messages").insertOne({ from: `${name}`, to: 'Todos', text: 'entra na sala...', type: 'status', time: `${hour}:${minute}:${second}` }) //revisitar a dayjs pra configurar a hora
        res.sendStatus(201)
    }
    catch {
        err => res.status(500).send(err.message)
    }
})
app.get("/participants", async (req, res) => {
    try {
       const participants = await db.collection("participants").find().toArray()
       res.send(participants)    
    } catch (error) {
        res.status(500).send(error.message)
    }
    
    
})

app.post("/messages", async (req, res) => { 
    const {User} = req.headers
    const {to, text, type} = req.body

    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid("message", "private_message").required()

    })
    const message = {to, text, type}
    const validation = messageSchema.validate(message, {abortEarly: false})
    if(validation.error){
        const error = validation.error.details.map(errors => errors.message)
        return res.status(422).send(error)
    }
    const authUser = await db.collection("participants").findOne({name: User})
    try {
        if(!authUser) return res.status(422).send("Você não está logado! Faça login e tente novamente.")
        await db.collection("messages").insertOne({from: User,...message, time: `${hour}:${minute}:${second}`})
        res.sendStatus(201)
    } catch (error) {
        res.status(500).send(error.message)
    }
})
app.get("/messages", (req, res) => { })

app.post("/status", (req, res) => { })


const PORT = 5000
app.listen(PORT)