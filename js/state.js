// Global mutable state — written by calculator, read by renderers
let staffId      = 0;
let livePool     = {};
let lastStaff    = [];
let lastTotal    = 0;
let lastTotH     = 0;
let lastRate     = 0;
let lastLeftover = 0;
let lastPoolAfter = {};
let lastRemainderBills = {};
let lastDistributionError = '';
let _lastDistStaff = [];
let cashMode     = 'perbill';
let perBillSnapshot = { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' };
let netBillSnapshot = { 100: '', 50: '', 20: '', 10: '', 5: '', 1: '' };
let netTotalSnapshot = '';
let isRestoringState = false;
let isSwitchingCashMode = false;
let isUpdatingNetTotal = false;
let currentInputError = '';

const $ = id => document.getElementById(id);
const DENOMS = [100, 50, 20, 10, 5, 1];
