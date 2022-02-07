const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const axios = require('axios')
const crypto = require('crypto')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3000

// apply middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const PAYMENT_BASE_URL = process.env.IS_PRODUCTION == 'yes' ? 'https://tripay.co.id/api/' : 'https://tripay.co.id/api-sandbox/'
const PAYMENT_API_KEY = process.env.IS_PRODUCTION == 'yes' ? process.env.TRIPAY_API_KEY_PRODUCTION : process.env.TRIPAY_API_KEY_TEST
const PAYMENT_PRIVATE_KEY = process.env.IS_PRODUCTION == 'yes' ? process.env.TRIPAY_PRIVATE_KEY_PRODUCTION : process.env.TRIPAY_PRIVATE_KEY_TEST
const PAYMENT_MERCHANT_CODE = process.env.IS_PRODUCTION == 'yes' ? process.env.TRIPAY_MERCHANT_CODE_PRODUCTION : process.env.TRIPAY_MERCHANT_CODE_TEST

app.get('/', (req, res) => {
    res.send('xixixi')
})

/**
 * docs https://tripay.co.id/developer?tab=merchant-fee-calculator - https://tripay.co.id/developer?tab=channels
 * @METHOD POST
 * @params merchant - string - [BRIVA, MANDIRIVA, BCAVA, CIMBVA, ALFAMART, INDOMARET, OVO, QRIS - shopee]
 * @params amount - integer
 * @return JSON
 */
app.post('/kalkulasi-pembayaran', async (req, res) => {
    try {
        console.log(req.body)
        const { merchant, amount } = req.body
        const response = await axios.get(`${PAYMENT_BASE_URL}merchant/fee-calculator?code=${merchant}&amount=${amount}`, {
            headers: {
                'Authorization': `Bearer ${PAYMENT_API_KEY}`
            },
            validateStatus: function (status) {
            return status < 999
            }
        })
        res.json(response.data)
    } catch (err) {
        console.log(err)
    }
})

/**
 * docs https://tripay.co.id/developer?tab=payment-instruction
 * @METHOD POST
 * @params merchant - string - [BRIVA, MANDIRIVA, BCAVA, CIMBVA, ALFAMART, INDOMARET, OVO, QRIS - shopee]
 * @params amount - integer
 * @params pay_code - integer
 * @params allow_html - 1 = true, 0 = false
 * @return JSON
 */
app.post('/instruksi-pembayaran', async (req, res) => {
    try {
        const { merchant, pay_code, amount, allow_html } = req.body
        const response = await axios.get(`${PAYMENT_BASE_URL}payment/instruction?code=${merchant}&pay_code=${pay_code}&amount=${amount}&allow_html=${allow_html}`, {
            headers: {
                Authorization: `Bearer ${PAYMENT_API_KEY}`
            }
        })
        res.json(response.data)
    } catch (err) {
        console.log(err)
    }
})

/**
 * docs https://tripay.co.id/developer?tab=transaction-create
 * @return JSON
 */
app.post('/buat-pembayaran', async (req, res) => {
    try {
        const {
            merchant_ref,
            amount,
            method,
            customer_name,
            customer_email,
            customer_phone,
            order_items,
            return_url
        } = req.body

        const signature = crypto.createHmac('sha256', PAYMENT_PRIVATE_KEY)
        .update(PAYMENT_MERCHANT_CODE + merchant_ref + amount)
        .digest('hex')

        const expiry = parseInt(Math.floor(new Date()/1000) + (2*60*60)) // 2 hour

        const payload = {
            merchant_ref,
            amount,
            method,
            customer_name,
            customer_email,
            customer_phone,
            order_items,
            return_url,
            expired_time: expiry,
            signature,
        }

        const response = await axios.post(`${PAYMENT_BASE_URL}transaction/create`,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${PAYMENT_API_KEY}`
                },
                validateStatus: function (status) {
                return status < 999; // ignore http error
            }
        })
        res.json(response.data)
    } catch (err) {
        console.log(err)
    }
})

/**
 * docs https://tripay.co.id/developer?tab=transaction-detail
 * @METHOD POST
 * @params reference
 * @return JSON
 */
 app.post('/detail-pembayaran', async (req, res) => {
    try {
        const { reference } = req.body
        const response = await axios.get(`${PAYMENT_BASE_URL}transaction/detail?reference=${reference}`, {
            headers: {
                Authorization: `Bearer ${PAYMENT_API_KEY}`
            }
        })
        res.json(response.data)
    } catch (err) {
        console.log(err)
    }
})

/**
 * callback when success make payment
 * docs https://tripay.co.id/developer?tab=callback
 */
app.post('/callback-payment', async (req, res) => {
    var json = req.body
    var signature = crypto.createHmac("sha256", PAYMENT_PRIVATE_KEY)
        .update(JSON.stringify(json))
        .digest('hex');

    const findSignatureHeader = req.rawHeaders.find(data => data == signature)
    console.log(signature == findSignatureHeader)
    if(findSignatureHeader != signature) return res.json({
        status: false,
        message: 'signature not valid'
    })

    const getDetailPesanan = await axios.post(`${process.env.REDICS_API_BASE_URL}get-pesanan-by-payment-reference`, {
        payment_reference: json.reference
    })

    return res.json(getDetailPesanan)
})

app.listen(PORT, () => {})