import { configureStore } from '@reduxjs/toolkit'

const rootReducer = (state = {}) => state

export default configureStore({ reducer: rootReducer })
