import Vue from 'vue'
import Vuex from '../vuex'
import test from './modules/test';

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    num: 1,
    addnum: 2
  },
  mutations: {
    ADD_NUM(state, payload) {
      state.num = payload;
    },
    DOWN_NUM(state) {
      state.num++;
    }
  },
  actions: {
    _add_num({ commit, dispatch }, payload) {
      commit('ADD_NUM', payload);
      dispatch({
        type: '_down_num'
      })
    },
    _down_num({ commit }) {
      commit('DOWN_NUM');
    }
  },
  getters: {
    newNum(state, getters) {
      console.log(getters);
      return state.num + state.addnum;
    }
  },
  modules: {
    test
  }
})
