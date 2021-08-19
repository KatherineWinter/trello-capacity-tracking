/* global TrelloPowerUp */

var Promise = TrelloPowerUp.Promise;

var BLACK_ROCKET_ICON = 'https://cdn.glitch.com/1b42d7fe-bda8-4af8-a6c8-eff0cea9e08a%2Frocket-ship.png?1494946700421';
const POWERUP_NAME = 'KW Capacity'
const SPRINT_TOTAL_HOURS = 50
const WORKING_HOURS_IN_DAYS = 6
const SPRINT_END = new Date('8/9/2021')

// Expects start date to be before end date
// start and end are Date objects
function businessDayDifference(start, end) {

  // Copy date objects so don't modify originals
  var s = new Date(+start);
  var e = new Date(+end);
  
  // Set time to midday to avoid dalight saving and browser quirks
  s.setHours(12,0,0,0);
  e.setHours(12,0,0,0);
  
  // Get the difference in whole days
  var totalDays = Math.round((e - s) / 8.64e7);
  
  // Get the difference in whole weeks
  var wholeWeeks = totalDays / 7 | 0;
  
  // Estimate business days as number of whole weeks * 5
  var days = wholeWeeks * 5;

  // If not even number of weeks, calc remaining weekend days
  if (totalDays % 7) {
    s.setDate(s.getDate() + wholeWeeks * 7);
    
    while (s < e) {
      s.setDate(s.getDate() + 1);

      // If day isn't a Sunday or Saturday, add to business days
      if (s.getDay() != 0 && s.getDay() != 6) {
        ++days;
      }
    }
  }
  return days;
}

function strFromRegex (cardName, regex, removeChars = []) {
  let match = cardName.match(regex)
  if (!match) { return '' }
  match = match[0]
  removeChars.forEach(char => { match = match.replace(char, '') })
  return match
}

function timeFromName (cardName, regex, removeChars = []) {
  const match = strFromRegex(cardName, regex, removeChars)
  const time = parseInt(match)
  return isNaN(time) ? 0 : time
}

function addAllocation (allocationInfo = {}, allocations = []) {
              const index = allocations.findIndex(allocation => allocation.name === allocationInfo.name)
              if (index === -1) {
                allocations.push(allocationInfo)
              } else {
                allocations[index].workedTime += allocationInfo.workedTime
                allocations[index].estimatedTime += allocationInfo.estimatedTime
              }
}

TrelloPowerUp.initialize({
  'board-buttons': (t, options) => {
    return [{
      icon: BLACK_ROCKET_ICON,
      text: POWERUP_NAME,
      callback: async (t) => {
        const cards = await t.cards('name', 'members')
        const allocations = []
        const projectAllocations = []
        let unallocatedTime = 0
        let totalTaskTimeLeft = 0
        cards.forEach(card => {
            const workedTime = timeFromName(card.name, /\((.*?)\)/g, ['(', ')'])
            const projectName = strFromRegex(card.name, /\{(.*?)\}/g, ['{', '}'])
            const estimatedTimeLeft = timeFromName(card.name, /\[(.*?)\]/g, ['[', ']'])
            totalTaskTimeLeft += estimatedTimeLeft
            
            if (projectName) {
              addAllocation({
                name: projectName,
                workedTime,
                estimatedTimeLeft
              }, projectAllocations)
            }
            
            card.members.forEach(member => {
              addAllocation({
                name: member.fullName,
                workedTime,
                estimatedTimeLeft
              }, allocations)
            })
            
            if (!card.members || !card.members.length) {
              unallocatedTime += estimatedTimeLeft
            }
        })
        
        const sprintTimeRemaining = (businessDayDifference(new Date(), SPRINT_END) - 1) * WORKING_HOURS_IN_DAYS
        const allocationItems = allocations.map(allocation => {
          const timeLeft = sprintTimeRemaining - allocation.estimatedTimeLeft
          let status = 'under capacity'
          if (timeLeft > 0 && timeLeft < 4) {
            status = 'at capacity'
          } else if (timeLeft < 0) {
            status = 'over capacity'
          }

          return {
            text: `${allocation.name} - ${status}: ${timeLeft}h left`
          }
        })
        
        const projectAllocationsItems = projectAllocations.map(allocation => {
          const timeLeft = sprintTimeRemaining - allocation.estimatedTimeLeft
          return {
            text: `${allocation.name} - ${timeLeft > 0 ? 'on track' : 'risk'}: ${timeLeft}h left`
          }
        })

        let items = []
        const sprintTotalTaskTimeLeft = sprintTimeRemaining - totalTaskTimeLeft
        items.push({
          text: `Sprint time left(h): ${sprintTotalTaskTimeLeft > 0 ? 'on track' : 'risk'}: ${totalTaskTimeLeft}h work left of ${sprintTimeRemaining}h`
        })
        
        items.push({
          text: `Unallocated time: ${unallocatedTime}h`
        })
        
        items.push({
          text: '---'
        })
        
        allocationItems.push({
          text: '---'
        })
        
        items = items.concat(allocationItems).concat(projectAllocationsItems)
        
        t.popup({
           title: POWERUP_NAME,
           items
        });
      }
    }]
  }
});
