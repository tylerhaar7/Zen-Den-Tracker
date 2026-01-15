// Zen Den Tracker - Supabase Database Layer

let supabaseClient = null;

/**
 * Initialize the Supabase client
 */
function initSupabase() {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
        throw new Error('Please configure your Supabase credentials in config.js');
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabaseClient;
}

/**
 * Get the Supabase client instance
 */
function getSupabase() {
    if (!supabaseClient) {
        throw new Error('Supabase not initialized. Call initSupabase() first.');
    }
    return supabaseClient;
}

// ============================================
// VISIT OPERATIONS
// ============================================

/**
 * Create a new visit (check-in)
 * @param {Object} visitData - The visit data
 * @returns {Promise<Object>} The created visit
 */
async function createVisit(visitData) {
    const { data, error } = await getSupabase()
        .from('visits')
        .insert([{
            student_name: visitData.studentName,
            grade_level: visitData.gradeLevel,
            staff_name: visitData.staffName,
            time_in: visitData.timeIn,
            time_out: null,
            reason: visitData.reason,
            emotion: visitData.emotion,
            date: visitData.date
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating visit:', error);
        throw new Error('Failed to check in student. Please try again.');
    }

    return data;
}

/**
 * Check out a student (set time_out)
 * @param {string} visitId - The visit UUID
 * @param {string} timeOut - The checkout timestamp (ISO string)
 * @returns {Promise<Object>} The updated visit
 */
async function checkOutVisit(visitId, timeOut = new Date().toISOString()) {
    const { data, error } = await getSupabase()
        .from('visits')
        .update({ time_out: timeOut })
        .eq('id', visitId)
        .select()
        .single();

    if (error) {
        console.error('Error checking out visit:', error);
        throw new Error('Failed to check out student. Please try again.');
    }

    return data;
}

/**
 * Get all currently active visits (time_out is null)
 * @returns {Promise<Array>} Array of active visits
 */
async function getActiveVisits() {
    const { data, error } = await getSupabase()
        .from('visits')
        .select('*')
        .is('time_out', null)
        .order('time_in', { ascending: true });

    if (error) {
        console.error('Error fetching active visits:', error);
        throw new Error('Failed to load active visits.');
    }

    return data || [];
}

/**
 * Get all visits with optional filters
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} Array of visits
 */
async function getAllVisits(filters = {}) {
    let query = getSupabase()
        .from('visits')
        .select('*')
        .order('date', { ascending: false })
        .order('time_in', { ascending: false });

    // Apply filters
    if (filters.startDate) {
        query = query.gte('date', filters.startDate);
    }
    if (filters.endDate) {
        query = query.lte('date', filters.endDate);
    }
    if (filters.gradeLevel && filters.gradeLevel !== 'all') {
        query = query.eq('grade_level', filters.gradeLevel);
    }
    if (filters.emotion && filters.emotion !== 'all') {
        query = query.eq('emotion', filters.emotion);
    }
    if (filters.studentName) {
        query = query.ilike('student_name', `%${filters.studentName}%`);
    }

    // Limit results if specified
    if (filters.limit) {
        query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching visits:', error);
        throw new Error('Failed to load visit history.');
    }

    return data || [];
}

// ============================================
// DASHBOARD / STATISTICS QUERIES
// ============================================

/**
 * Get count of visits for today
 * @returns {Promise<number>} Count of today's visits
 */
async function getTodayCount() {
    const today = new Date().toISOString().split('T')[0];

    const { count, error } = await getSupabase()
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .eq('date', today);

    if (error) {
        console.error('Error fetching today count:', error);
        return 0;
    }

    return count || 0;
}

/**
 * Get count of visits for this week (Sunday to Saturday)
 * @returns {Promise<number>} Count of this week's visits
 */
async function getWeekCount() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const { count, error } = await getSupabase()
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .gte('date', startOfWeek.toISOString().split('T')[0]);

    if (error) {
        console.error('Error fetching week count:', error);
        return 0;
    }

    return count || 0;
}

/**
 * Get count of visits for this month
 * @returns {Promise<number>} Count of this month's visits
 */
async function getMonthCount() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { count, error } = await getSupabase()
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .gte('date', startOfMonth.toISOString().split('T')[0]);

    if (error) {
        console.error('Error fetching month count:', error);
        return 0;
    }

    return count || 0;
}

/**
 * Get breakdown of visits by grade level
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Object with grade levels as keys and counts as values
 */
async function getGradeBreakdown(startDate, endDate) {
    let query = getSupabase()
        .from('visits')
        .select('grade_level');

    if (startDate) {
        query = query.gte('date', startDate);
    }
    if (endDate) {
        query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching grade breakdown:', error);
        return {};
    }

    // Count by grade level
    const breakdown = { 'K': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0 };
    (data || []).forEach(visit => {
        if (breakdown.hasOwnProperty(visit.grade_level)) {
            breakdown[visit.grade_level]++;
        }
    });

    return breakdown;
}

/**
 * Get breakdown of visits by emotion
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Object with emotions as keys and counts as values
 */
async function getEmotionBreakdown(startDate, endDate) {
    let query = getSupabase()
        .from('visits')
        .select('emotion');

    if (startDate) {
        query = query.gte('date', startDate);
    }
    if (endDate) {
        query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching emotion breakdown:', error);
        return {};
    }

    // Count by emotion
    const emotions = ['Angry', 'Sad', 'Anxious/Worried', 'Frustrated', 'Overwhelmed', 'Tired', 'Other'];
    const breakdown = {};
    emotions.forEach(e => breakdown[e] = 0);

    (data || []).forEach(visit => {
        if (breakdown.hasOwnProperty(visit.emotion)) {
            breakdown[visit.emotion]++;
        }
    });

    return breakdown;
}

/**
 * Get breakdown of visits by time of day (morning vs afternoon)
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Object with morning/afternoon counts
 */
async function getTimeOfDayBreakdown(startDate, endDate) {
    let query = getSupabase()
        .from('visits')
        .select('time_in');

    if (startDate) {
        query = query.gte('date', startDate);
    }
    if (endDate) {
        query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching time of day breakdown:', error);
        return { morning: 0, afternoon: 0 };
    }

    const breakdown = { morning: 0, afternoon: 0 };

    (data || []).forEach(visit => {
        const hour = new Date(visit.time_in).getHours();
        if (hour < 12) {
            breakdown.morning++;
        } else {
            breakdown.afternoon++;
        }
    });

    return breakdown;
}

/**
 * Get frequent visitors (students with multiple visits in a time period)
 * @param {number} days - Number of days to look back
 * @param {number} minVisits - Minimum number of visits to be considered frequent
 * @returns {Promise<Array>} Array of {student_name, grade_level, visit_count}
 */
async function getFrequentVisitors(days = 30, minVisits = 3) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await getSupabase()
        .from('visits')
        .select('student_name, grade_level')
        .gte('date', startDate.toISOString().split('T')[0]);

    if (error) {
        console.error('Error fetching frequent visitors:', error);
        return [];
    }

    // Count visits per student
    const visitCounts = {};
    (data || []).forEach(visit => {
        const key = `${visit.student_name}|||${visit.grade_level}`;
        visitCounts[key] = (visitCounts[key] || 0) + 1;
    });

    // Filter and format results
    const frequentVisitors = Object.entries(visitCounts)
        .filter(([_, count]) => count >= minVisits)
        .map(([key, count]) => {
            const [studentName, gradeLevel] = key.split('|||');
            return {
                student_name: studentName,
                grade_level: gradeLevel,
                visit_count: count
            };
        })
        .sort((a, b) => b.visit_count - a.visit_count);

    return frequentVisitors;
}

/**
 * Get all dashboard statistics at once
 * @param {string} startDate - Optional start date for breakdowns
 * @param {string} endDate - Optional end date for breakdowns
 * @returns {Promise<Object>} All dashboard data
 */
async function getDashboardStats(startDate, endDate) {
    const [
        todayCount,
        weekCount,
        monthCount,
        gradeBreakdown,
        emotionBreakdown,
        timeOfDayBreakdown,
        frequentVisitors
    ] = await Promise.all([
        getTodayCount(),
        getWeekCount(),
        getMonthCount(),
        getGradeBreakdown(startDate, endDate),
        getEmotionBreakdown(startDate, endDate),
        getTimeOfDayBreakdown(startDate, endDate),
        getFrequentVisitors(30, 3)
    ]);

    return {
        todayCount,
        weekCount,
        monthCount,
        gradeBreakdown,
        emotionBreakdown,
        timeOfDayBreakdown,
        frequentVisitors
    };
}
