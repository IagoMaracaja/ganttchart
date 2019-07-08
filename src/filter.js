export default class Filter {
    constructor(gantt) {
        this.gantt = gantt;
    }

    getFilter() {
        return `
        <div class="radio-btn">
            <label class="container">Days
               <input type="radio" id="radioDay" checked="checked" name="radio">
               <span class="checkmark"/>
            </label>
            <label class="container">Week
              <input type="radio" id="radioWeek" name="radio">
              <span class="checkmark"/>
            </label>
            <label class="container">Month
              <input type="radio" id="radioMonth" name="radio">
              <span class="checkmark"/>
            </label>
        </div>
    `;
    }

    checkDefault(filterType) {
        switch (filterType) {
            case 1:
                let radioBtnDay = document.getElementById('radioDay');
                radioBtnDay.setAttribute('checked', true);
                break;
            case 2:
                let radioBtnWeek = document.getElementById('radioWeek');
                radioBtnWeek.setAttribute('checked', true);
                break;
            case 3:
                let radioBtnMonth = document.getElementById('radioMonth');
                radioBtnMonth.setAttribute('checked', true);
                break;
        }

    }

    setClick(gantt) {
        let radioBtnDay = document.getElementById('radioDay');
        radioBtnDay.addEventListener(
            'click',
            function() {
                Filter.changeFilter(1, gantt);
            },
            false
        );
        let radioBtnWeek = document.getElementById('radioWeek');
        radioBtnWeek.addEventListener(
            'click',
            function() {
                Filter.changeFilter(2, gantt);
            },
            false
        );
        let radioBtnMonth = document.getElementById('radioMonth');
        radioBtnMonth.addEventListener(
            'click',
            function() {
                Filter.changeFilter(3, gantt);
            },
            false
        );
    }

    static changeFilter(filterType, gantt) {
        switch (filterType) {
            case 1:
                gantt.refreshByFilter('Day');
                break;
            case 2:
                gantt.refreshByFilter('Week');
                break;
            case 3:
                gantt.refreshByFilter('Month');
                break;
        }
    }
}
