export default {
  namespaced: true,
  state: {
    name: '456'
  },
  mutations: {
    SET_NAME(state, payload) {
      state.name = payload;
    }
  },
  actions: {
    _async_set_name({ commit, getters }, payload) {
      console.log(getters)
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          commit('SET_NAME', payload);
          console.log(resolve)
          reject(1);
        })
      })
      
    }
  },
  getters: {
    newName(state, getters, rootState, rootGetters) {
      return state.name + getters.age + rootState.num + rootGetters.newNum
    },
    age() {
      return 10;
    }
  }
}