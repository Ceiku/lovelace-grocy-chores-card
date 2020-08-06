customElements.whenDefined('card-tools').then(() => {
  let cardTools = customElements.get('card-tools');
    
  class GrocyChoresCard extends cardTools.LitElement {
    
    setConfig(config) {
      if (!config.entity) {
        throw new Error('Please define entity');
      }
      this.config = config;
    }
    
    calculateDueDate(dueDate){
      var oneDay = 24*60*60*1000; // hours*minutes*seconds*milliseconds
      var today = new Date();
      today.setHours(0,0,0,0)

      var splitDate = dueDate.split(/[- :T]/)
      var parsedDueDate = new Date(splitDate[0], splitDate[1]-1, splitDate[2]);
      parsedDueDate.setHours(0,0,0,0)
      
      var dueInDays;
      if(today > parsedDueDate) {
        dueInDays = -1;
      }
      else
        dueInDays = Math.round(Math.abs((today.getTime() - parsedDueDate.getTime())/(oneDay)));

      return dueInDays;
    }

    checkDueClass(dueInDays) {
      if (dueInDays == 0)
        return "due-today";
      else if (dueInDays < 0)
        return "overdue";
      else
        return "not-due";
    }

    formatDueDate(dueDate, dueInDays) {
      if (dueInDays < 0)
        return this.translate("Overdue");
      else if (dueInDays == 0)
        return this.translate("Today");
      else
        return dueDate.substr(0, 10);
    }

    translate(string) {
      if((this.config.custom_translation != null) &&
          (this.config.custom_translation[string] != null))
          {
             return this.config.custom_translation[string];
          }
      return string;
    }
  
    render(){
      return cardTools.LitHtml
      `
        ${this._renderStyle()}
        ${cardTools.LitHtml
          `<ha-card>
            <div class="header">
              <div class="name">
                ${this.header}
              </div>
            </div>
            <div class=${this.columns == 1 ? "" : "container" }>
              ${this.chores.length > 0
              ? this._renderChores()
              : cardTools.LitHtml`<div class="info flex">${this.translate("No chores")}!</div>`}
            </div>
            ${this.notShowing.length > 0 ? cardTools.LitHtml
              `
              <div class="secondary">
                  ${this.translate("Look in Grocy for {number} more chores").replace("{number}", this.notShowing.length)}
              </div>
              `
            : ""}
          </ha-card>`}
      `;
    } 

    _track(choreId){
      this._hass.callService("grocy", "execute_chore", {
        chore_id: choreId,
        tracked_time: new Date().toISOString(),
        done_by: this.userId
      });
    }

    _renderChores() {
      if (this.columns == 1) {
        return cardTools.LitHtml
        `<div>${this.chores.map(chore => this._renderChore(chore))}</div>`
      }
      var maxItemsInColumn = this.chores.length / this.columns;
      var choreChunks = this._chunkArray(this.chores, maxItemsInColumn);
      return choreChunks.map(choreChunk => cardTools.LitHtml`<div class="chore-column">${choreChunk.map(chore => this._renderChore(chore))}</div>`)

    }

    _chunkArray(myArray, chunk_size){
      var index = 0;
      var arrayLength = myArray.length;
      var tempArray = [];
      
      for (index = 0; index < arrayLength; index += chunk_size) {
          var myChunk = myArray.slice(index, index+chunk_size);
          // Do something if you want with the group
          tempArray.push(myChunk);
      }
  
      return tempArray;
  }

    _renderChore(chore) { 
      return cardTools.LitHtml`
      <div class="chore flex">
        <div>
          ${chore._name}
          <div class="secondary">
            ${this.translate("Due")}: <span class="${chore._next_estimated_execution_time != null ? this.checkDueClass(chore.dueInDays) : ""}">${chore._next_estimated_execution_time != null ? this.formatDueDate(chore._next_estimated_execution_time, chore.dueInDays) : "-"}</span>
          </div>
          <div class="secondary">
            ${this.translate("Last tracked")}: ${chore._last_tracked_time != null ? chore._last_tracked_time.substr(0, 10) : "-"} ${
              chore._last_done_by._display_name != null ? this.translate("by") + " " + chore._last_done_by._display_name : ""
            }
          </div>
        </div>
        <div>
          <mwc-button @click=${ev => this._track(chore._chore_id)}>${this.translate("Track")}</mwc-button>
        </div>
      </div>`
    }

    _renderStyle() {
        return cardTools.LitHtml
        `
          <style>
            ha-card {
              padding: 16px;
              overflow: auto;
            }
            .header {
              padding: 0;
              @apply --paper-font-headline;
              line-height: 40px;
              color: var(--primary-text-color);
              padding: 4px 0 12px;
            }
            .container {
              display: flex;
            }
            .chore-column {
              flex: none;
            }
            .chore {
              padding-bottom: 1em;
            }
            .flex {
              display: flex;
              justify-content: space-between;
            }
            .overdue {
              color: red !important;
            }
            .due-today {
              color: orange !important;
            }
            .secondary {
              display: block;
              color: #8c96a5;
          }
          </style>
        `;
      }
    
    set hass(hass) {
      this._hass = hass;
      
      const entity = hass.states[this.config.entity];
      this.header = this.config.title == null ? "Chores" : this.config.title;
      this.userId = this.config.user_id == null ? 1 : this.config.user_id;

      this.show_quantity = this.config.show_quantity == null ? null : this.config.show_quantity;
      this.columns = this.config.columns == null ? 1 : this.config.columns;
      this.show_days = this.config.show_days == null ? null : this.config.show_days;

      if (entity.state == 'unknown')
        throw new Error("The Grocy sensor is unknown.");
        
      var chores = entity.attributes.items;
      var allChores = []

      if(chores != null){
        chores.sort(function(a,b){
          if (a._next_estimated_execution_time != null && b._next_estimated_execution_time != null) {
            var aSplitDate = a._next_estimated_execution_time.split(/[- :T]/)
            var bSplitDate = b._next_estimated_execution_time.split(/[- :T]/)
  
            var aParsedDueDate = new Date(aSplitDate[0], aSplitDate[1]-1, aSplitDate[2]);
            var bParsedDueDate = new Date(bSplitDate[0], bSplitDate[1]-1, bSplitDate[2]);
  
            return aParsedDueDate - bParsedDueDate;
          }
            return;
        })

        chores.map(chore =>{
          var dueInDays = chore._next_estimated_execution_time ? this.calculateDueDate(chore._next_estimated_execution_time) : 10000;
          chore.dueInDays = dueInDays;
          if(this.show_days != null) {
            if(dueInDays <= this.show_days){
              allChores.push(chore);
            }
            else if(chore._next_estimated_execution_time != null && chore._next_estimated_execution_time.slice(0,4) == "2999") {
              chore._next_estimated_execution_time = "-";
              allChores.unshift(chore)
            }
          }
          else {
            if(chore._next_estimated_execution_time == null || dueInDays == 10000 || chore._next_estimated_execution_time.slice(0,4) == "2999"){
              chore._next_estimated_execution_time = "-";
              allChores.unshift(chore)
            }
            else
              allChores.push(chore);
          }
        })
        


        if(this.show_quantity != null){
          this.chores = allChores.slice(0, this.show_quantity);
          this.notShowing = allChores.slice(this.show_quantity);
        }
        else{
          this.chores = allChores;
          this.notShowing = 0;
        }
      }
      else
        this.chores = allChores;
      
      this.state = entity.state
      this.requestUpdate();
    }
    
    // @TODO: This requires more intelligent logic
    getCardSize() {
      return 3;
    }
  }
  
  customElements.define('grocy-chores-card', GrocyChoresCard);
  });
  
  window.setTimeout(() => {
    if(customElements.get('card-tools')) return;
    customElements.define('grocy-chores-card', class extends HTMLElement{
      setConfig() { throw new Error("Can't find card-tools. See https://github.com/thomasloven/lovelace-card-tools");}
    });
  }, 2000);
