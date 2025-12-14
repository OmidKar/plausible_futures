# Plausible Futures - User Manual

## 🎯 What is this application?

The Plausible Futures Ideation App is a collaborative tool for brainstorming and voting on future scenarios. Teams work together to explore how AI might impact different topics, then vote on the most interesting ideas.

---

## 📝 Getting Started

### Step 1: Access the Application

Open your web browser and go to:
```
http://your-vm-address:8080
```

You'll see the login screen.

### Step 2: Create Your Account

**First-time users:**
1. Click the **"Sign Up"** tab
2. Enter your information:
   - **Email address** (this will be your username)
   - **Display name** (what others will see)
   - **Password** (choose a secure password)
3. Click **"Sign Up"**
4. You're ready to start!

**Returning users:**
1. Stay on the **"Sign In"** tab
2. Enter your email and password
3. Click **"Sign In"**

---

## 👥 Two Types of Users

### **Moderator** (Session Creator)
- Creates and manages the session
- Sets up topics for discussion
- Controls when voting starts
- Tracks participation progress
- Publishes final results

### **Participant** (Contributor)
- Joins existing sessions
- Contributes ideas to each topic
- Votes on others' contributions
- Downloads final report

---

## 🎭 For Moderators: Creating a Session

### Step 1: Create Session

After signing in, you'll see the session management panel:

1. Click **"Create New Session"**
2. Enter a **Session Name** (e.g., "Finance AI Impact Session - Dec 2025")
3. The system generates a **Session ID** automatically (e.g., `session-123abc`)
4. **Share this Session ID** with participants so they can join

### Step 2: Add Topics

Now you'll build the structure for your ideation session:

1. In the **"Add New Topic"** section:
   - **Domain**: Category or area (e.g., "Finance", "Healthcare")
   - **Topic**: Specific subject (e.g., "Fraud Detection", "Patient Records")
2. Click **"Add Topic"** to create the row
3. Repeat for all topics you want to discuss (typically 5-10 topics)

Each topic will have 4 columns for participants to fill:
- **Current Status**: How things work today
- **Minor Impact by AI**: Small improvements possible with AI
- **Disruption by AI**: Major transformations AI could bring
- **Reimagination by AI**: Completely new approaches enabled by AI

### Step 3: Lock Topics

After adding all topics:
1. Review each topic
2. Click **"Lock Topic"** for each row
3. Once ALL topics are locked, the **"Finalize Structure & Publish"** button becomes active
4. Click **"Finalize Structure & Publish"**

**✅ Session is now published!** Participants can join and start contributing.

### Step 4: Monitor Participation

While participants are working:

1. Click **"Show Submission Status"** button
2. You'll see:
   - Total participants who joined
   - Who has submitted (✓ green checkmark)
   - Who is still working (⏳ pending)
   - Submission timestamps

**Tip:** Wait until most participants have submitted before enabling voting.

### Step 5: Enable Voting

When ready to start voting:

1. Click **"Enable Voting"** button
2. All participants will be notified
3. They can now view each other's contributions and vote

### Step 6: Lock Voting & Publish Results

After voting period ends:

1. Click **"Lock Votes"** (no more voting allowed)
2. Review the results
3. Click **"Publish Final View"**
4. Everyone can now download the final report

### Step 7: Download Report

Click **"Download Report"** to get a JSON file with:
- All contributions
- Vote counts
- Ranked results (sorted by votes)
- Participant information

---

## 👤 For Participants: Joining a Session

### Step 1: Get Session ID

Your moderator will share a **Session ID** (looks like `session-1734179234567-abc123`).

### Step 2: Join Session

After signing in:

1. You'll see **"Join Existing Session"** section
2. Paste the **Session ID**
3. Click **"Join Session"**

**✅ You're in!** You'll see all topics set up by the moderator.

### Step 3: Contribute Your Ideas

For each topic, fill in the four columns:

**📊 Example Topic: "Fraud Detection"**

| Column | What to Write | Example |
|--------|--------------|---------|
| **Current Status** | How it works today | "Manual review of flagged transactions by analysts" |
| **Minor Impact by AI** | Small improvements | "AI flags suspicious patterns, analysts still review" |
| **Disruption by AI** | Major changes | "AI automatically blocks 90% of fraud in real-time" |
| **Reimagination by AI** | Revolutionary ideas | "Predictive AI prevents fraud before it happens" |

**Tips:**
- Be specific and concrete
- Think progressively (minor → disruption → reimagination)
- No right or wrong answers
- You can edit until you submit

### Step 4: Submit Your Contributions

1. Review all your entries
2. Click **"Submit Table"** button
3. You'll see a confirmation: **"✓ You have submitted your contributions. Thank you!"**
4. Your entries are now locked (read-only)

**⏳ Wait for moderator to enable voting**

### Step 5: Vote on Ideas

When the moderator enables voting:

1. You'll see a message: **"✓ Voting is now available!"**
2. Click **"View Contributions & Vote"**
3. You'll see cards showing everyone's contributions
4. For each idea you like, click the **"↑ Vote"** button
5. Vote counts update in real-time

**Voting Rules:**
- You can vote on multiple ideas
- You cannot vote on your own contributions
- You can only vote once per contribution

### Step 6: View Final Results

After the moderator locks voting:

1. Click **"Show Results"**
2. You'll see:
   - All contributions ranked by votes
   - **Leaderboard** showing top 3 ideas
   - Vote counts for each contribution
3. Click **"Download Report"** to save the results

---

## 🔄 Session Workflow (Quick Reference)

```
1. SETUP (Moderator Only)
   └─> Create session → Add topics → Lock topics → Publish
   
2. CONTRIBUTION (All Participants)
   └─> Join session → Fill in ideas → Submit
   
3. VOTING (After Moderator Enables)
   └─> View all contributions → Vote on favorites
   
4. FINAL RESULTS (After Moderator Locks)
   └─> View ranked results → Download report
```

---

## 💡 Tips & Best Practices

### For Moderators:

1. **Plan topics in advance**: Have 5-10 well-defined topics ready
2. **Clear topic names**: Be specific (not "AI" but "AI in Customer Service")
3. **Set deadlines**: Tell participants when contributions are due
4. **Monitor progress**: Use submission status to follow up with pending participants
5. **Allow voting time**: Give 10-15 minutes for voting after all submissions are in
6. **Download report**: Save the report for future reference

### For Participants:

1. **Be specific**: Write concrete examples, not vague statements
2. **Think progressively**: Minor → Disruption → Reimagination (increasing boldness)
3. **Save often**: Your drafts are saved automatically in your browser
4. **Don't rush**: Take time to think through each column
5. **Vote thoughtfully**: Consider feasibility, impact, and creativity
6. **Vote on multiple ideas**: You're not limited to one vote

---

## ❓ Frequently Asked Questions

### Can I edit my contributions after submitting?
**No.** Once submitted, contributions are locked. Review carefully before clicking "Submit Table".

### Can I see others' contributions before submitting mine?
**No.** Contributions are private until the moderator enables voting. This prevents groupthink.

### How many votes can I cast?
**Unlimited**, but only one vote per contribution. You cannot vote on your own ideas.

### What if I lose my work?
Your drafts are saved in your browser's local storage. If you close the tab and return, your work will be there (as long as you haven't cleared your browser cache).

### Can I join multiple sessions?
**Yes!** You can be in multiple sessions, but work on one at a time. Use "Leave Session" to switch.

### What happens if the moderator doesn't enable voting?
Participants wait in a holding state. Only moderators can transition between stages. Contact your moderator if you're stuck.

### Can I rejoin a session after leaving?
**Yes!** Just enter the Session ID again. Your previous contributions are preserved.

### What format is the report?
JSON format, which can be opened in any text editor or imported into analysis tools (Excel, Python, R).

---

## 🆘 Troubleshooting

### "Session not found" error
- Double-check the Session ID (case-sensitive)
- Ask moderator to confirm the session is published
- Try refreshing the page

### Can't submit contributions
- Ensure all required fields have content
- Check that the session is in contribution phase (not voting yet)
- Try refreshing the page

### Vote button doesn't work
- Check that voting is enabled (you should see "Voting is now available" message)
- Ensure you're not trying to vote on your own contribution
- You may have already voted on that contribution

### Browser issues
- **Recommended browsers**: Chrome, Firefox, Edge (latest versions)
- **Clear cache**: If things look broken, clear your browser cache
- **Private mode**: Works, but your drafts won't persist across sessions

### Lost your password?
Contact your system administrator. Password reset is not yet implemented in the current version.

---

## 📞 Support

For technical issues or questions:
- Contact your session moderator
- Contact your IT administrator
- Report bugs to the development team

---

## 🔒 Privacy & Data

### What data is collected?
- Email address (for login)
- Display name (shown to others)
- Your contributions (ideas you write)
- Vote counts on contributions

### What is NOT tracked?
- **Individual votes**: We only track vote COUNTS, not who voted for what
- **Draft history**: Only final submissions are saved
- **Browser activity**: No tracking cookies

### Can others see my email?
Only your display name is shown in the voting and final report views. Your email is visible to the moderator in the participant list.

---

## 📊 Report Structure

The downloaded report includes:

```json
{
  "session": {
    "name": "Session Name",
    "moderator": {...},
    "participants": [...]
  },
  "topics": [
    {
      "domain": "Finance",
      "topic": "Fraud Detection",
      "totalVotes": 15,
      "contributions": [
        {
          "author": "Display Name",
          "currentStatus": "...",
          "minorImpact": "...",
          "disruption": "...",
          "reimagination": "...",
          "votes": 5
        }
      ]
    }
  ]
}
```

**Data is sorted by:**
- Topics sorted by total votes (highest first)
- Contributions within each topic sorted by votes

---

## 🎓 Session Example (Step by Step)

### Scenario: Team exploring AI impact on Finance operations

**Day 1 - Setup (Moderator):**
1. Create session: "Finance AI Impact - Q1 2025"
2. Add topics:
   - Fraud Detection
   - Invoice Processing
   - Credit Scoring
   - Customer Service
   - Risk Management
3. Lock all topics and publish
4. Share session ID with team: `session-1734179234567-finance`

**Day 1 - Contribution (Team):**
1. 10 team members join using session ID
2. Each person fills in their ideas for all 5 topics
3. Takes 30-60 minutes per person
4. Everyone submits when ready

**Day 2 - Voting (Everyone):**
1. Moderator enables voting after checking submission status
2. Team reviews all 50 contributions (10 people × 5 topics)
3. Everyone votes on ideas they find most interesting
4. Voting takes 15-20 minutes

**Day 2 - Results (Everyone):**
1. Moderator locks votes and publishes final view
2. Team views leaderboard and ranked contributions
3. Everyone downloads report
4. Results used for strategic planning discussions

---

## 📋 Quick Reference Card

### Moderator Actions
| Action | When Available | Button Location |
|--------|---------------|-----------------|
| Create Session | After login | Session panel |
| Add Topics | Setup phase | Topic input section |
| Finalize Structure | All topics locked | Top toolbar |
| View Submission Status | Contribution phase | Toolbar |
| Enable Voting | After submissions | Toolbar |
| Lock Votes | During voting | Toolbar |
| Publish Final View | Votes locked | Toolbar |
| Download Report | Final phase | Toolbar |

### Participant Actions
| Action | When Available | Location |
|--------|---------------|----------|
| Join Session | After login | Session panel |
| Fill Contributions | After joining | Topic table |
| Submit Table | Filled all topics | Bottom of page |
| View Contributions & Vote | Voting enabled | Toolbar |
| Vote on Ideas | Voting phase | Contribution cards |
| Show Results | Final phase | Toolbar |
| Download Report | Final phase | Toolbar |

---

**Version:** 1.0  
**Last Updated:** December 2025  
**For support:** Contact your session moderator or IT administrator

