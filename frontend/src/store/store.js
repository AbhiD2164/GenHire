import { configureStore } from '@reduxjs/toolkit'
import { combineReducers } from 'redux'

// placeholder slices
const rootReducer = combineReducers({})

export default configureStore({ reducer: rootReducer })
