/*jshint browser:true*/
/*global MashupPlatform*/

(function() {

	"use strict";
	
	var condValues = ['typeOfService', 'description'];
	var tableHeaders = ['id','typeOfService', 'description'];
	var tot_mess = 0;
	
	var Esempio = function Esempio() {
		this.my_body = null;
		this.contenitore = null; /* stdout */
		
		this.contenitore_tabella = null; /* div per la tabella */
		this.connection = null;
		
		this.ngsi_server = null;
		this.ngsi_proxy = null;
		
		this.subscriptionId = null;
		
		this.table = null;
		this.table_output = null;

		this.serviceList = null;
		
	};

	Esempio.prototype.init = function init() {
		
		this.serviceList = [];
		
		var my_body = document.getElementsByTagName("body")[0];
		
		var contenitore = document.createElement("div");
		contenitore.setAttribute("id","idContenitore");

		var contenitore_tabella = document.createElement("div");
		contenitore_tabella.setAttribute("id","tabellaContenitore");
		
		this.my_body = my_body;
		this.contenitore = contenitore;
		this.contenitore_tabella = contenitore_tabella;
		
		
		this.my_body.appendChild(this.contenitore);
		this.my_body.appendChild(this.contenitore_tabella);
		
		createTableOutPut.call(this);
		createTable.call(this);
		this.contenitore.appendChild(this.table_output);
		this.contenitore_tabella.appendChild(this.table);
		//this.table.addEventListener("click", handlerClickRow.bind(this), false);
		retrieveServicesFromServerNGSI.call(this);
		
	};
	
	/*
	 * Utils
	 */
	
	var printDebug = function printDebug(f, e){
		var current_funct = f;
		var d = new Date();
		var h = d.getHours();
		var m = d.getMinutes();
		var s = d.getSeconds();
		var attributes = '';
		if(f === 'onSuccess'){
			attributes = '[' + 'subId=' + e.subscriptionId + ',' + 'duration='+ e.duration + ']'
		}
		else if(f === 'onNotify'){
			attributes = '[' + 'serId=' + e.id + ',' + 'serType='+ e.typeOfService + ']'
		}
		var current_date = '['+h+':'+m+':'+s+']'+'['+f+']'+attributes;
		msgToOuput.call(this, current_date);
		
		//aggiorno l'header della tabella di output
		tot_mess = tot_mess + 1;
		var x = document.getElementById("outputTable").rows[0].cells;
		x[0].innerHTML = 'Number of messages received ' + tot_mess;
		
	} 
	
	var retrieveServicesFromServerNGSI = function retrieveServicesFromServerNGSI()
	{
		this.ngsi_server = MashupPlatform.prefs.get('ngsi_server');
		this.ngsi_proxy = MashupPlatform.prefs.get('ngsi_proxy');
		
		this.connection = new NGSI.Connection(this.ngsi_server, {
			use_user_fiware_token: true,
            ngsi_proxy_url: this.ngsi_proxy
        });
		
		/* valorizzo i parametri da passare alla sottoscrizione 
		 * entityList:
		 * attributeList:
		 * duration:
		 * throttiling:
		 * notifyConditions:
		 * options:
		 * */
		var type = 'Service';
		var entityList = []; /* lista delle entità a cui sottoscriversi */
		var attributeList = null;
        var duration = 'PT3H';
        var throttling = null;
        var notifyConditions = [];
        
		/* mi sottoscrivo a tutte le entità di tipo Service */
		var entity = {
				id: '.*',
				type: type,
				isPattern: true
		};
		entityList.push(entity);
		
		var conditions = {
				'type': 'ONCHANGE',
	            'condValues': condValues	
		}
		notifyConditions.push(conditions);
		
		var options = {
            flat: true,
            onNotify: handlerReceiveEntity.bind(this),
            onSuccess: function (data) {
                this.subscriptionId = data.subscriptionId;
 
                /*
                var linea = "----------------------------------------" + "\n";
        		var ok = "OnSuccess: OK\n";
        		var info = JSON.stringify(data)+"\n";
        		var testo = linea + ok + info + linea;
        		var response = document.createTextNode(testo);
        		this.contenitore.appendChild(response);
                */
                printDebug.call(this, 'onSuccess', data);
                this.refresh_interval = setInterval(refreshNGSISubscription.bind(this), 1000 * 60 * 60 * 2);  // each 2 hours
                window.addEventListener("beforeunload", function () {
                    this.connection.cancelSubscription(this.subscriptionId);
                }.bind(this));
            }.bind(this)
        };
		
		this.connection.createSubscription(entityList, attributeList, duration, throttling, notifyConditions, options);
		
	};
	
	/*
	 * Table and graphics
	 */
	
	/*
	var createTable = function createTable()
	{
		
		var columns = [
		    {field:"id", label:"#", width:"95px", sortable:true},
		    {field:"typeOfService", label:"Type_of_service", width:"95px", sortable:true},
		    {field:"description", label:"Description", sortable: true}
		];
	    this.table = new StyledElements.ModelTable(columns);
	    this.table.insertInto(this.my_body);
	    this.table.addEventListener("click", handlerClickRow.bind(this), false);
	    //updateTable.call(this);
	    this.table.repaint();
		
	};
	*/
	
	var handlerClickRow = function handlerClickRow (rowSelected) {
		var cells = rowSelected.cells;
		var idRowService = cells[0];
		var typeRowService = cells[1];
		var descRowService = cells[2];
		var textId = idRowService.innerHTML;
		var textType = typeRowService.innerHTML;
		var textDesc = descRowService.innerHTML;
		
		var serviceOutput = {};
		serviceOutput.id = textId;
		serviceOutput.typeOfService = textType;
		serviceOutput.description = textDesc;
		var outputData = JSON.stringify(serviceOutput);
		MashupPlatform.wiring.pushEvent('outputService', outputData);
		
		/*
		var service;
        var idToSearch = serviceFromTable.id;
        var found = false;
        var i = 0;

        while(!found){
            service = this.serviceList[i];
            if (service.id === idToSearch){
                found = true;
            }
            i++;
        }
        MashupPlatform.wiring.pushEvent('outputService', JSON.stringify(service));
		*/
		
	};
	
	/*
	 * connection
	 */
	
	var refreshNGSISubscription = function refreshNGSISubscription() {
        if (this.subscriptionId) {
            var duration = 'PT3H';
            var mythrottling = 'PT5S';
            var notifyConditions = [{
                'type': 'ONCHANGE',
                'condValues': condValues
            }];
            var options = {};
            this.connection.updateSubscription(this.subscriptionId, duration, mythrottling, notifyConditions, options);
        }
    };
    
    /*
     * Table
     */

    var createTableOutPut = function createTableOutPut()
    {
    	var table_output = document.createElement("table");
    	table_output.setAttribute("id","outputTable");
    	var tbody = document.createElement("tbody");
    	table_output.appendChild(tbody);
    	
    	var row_header = document.createElement("tr");
		var new_cell = document.createElement("th");
		new_cell.innerHTML =  'Number of messages received ' + tot_mess;
		row_header.appendChild(new_cell);
    
    	tbody.appendChild(row_header);
    	
    	this.table_output = table_output;
    }; 

    var msgToOuput = function msgToOuput(text)
    {
    	var table = document.getElementById("outputTable");
    	var row = table.insertRow(1);
		var mgs = row.insertCell(0);
		mgs.innerHTML = text;
    }
  
    var createTable = function createTable()
    {
    	/* creo l'intestazione della tabella
    	 * <table id="servicesTable">
    	 * 	<tr>
    	 * 		<th>id</th>
    	 * 		<th>typeOfService</th>
    	 * 		<th>description</th>
    	 * 	</tr>
    	 * </table>
    	 */
    	var num_col = 3;
    	var table = document.createElement("table");
    	table.setAttribute("id","servicesTable");
    	var tbody = document.createElement("tbody");
    	table.appendChild(tbody);
    	
    	var row_header = document.createElement("tr");
    	for(var i=0; i<num_col; i++){
    		var new_cell = document.createElement("th");
    		new_cell.innerHTML =  tableHeaders[i];
    		row_header.appendChild(new_cell);
    	}
    	tbody.appendChild(row_header);
    	
    	this.table = table;
    };
    
    var deleteTable = function deleteTable(){
    	var table = document.getElementById("servicesTable");
    	var nrows = table.rows.length;
    	if(nrows>1){//se c'è qualche riga (row=1 header)
	    	for(var i in this.serviceList)
	    	{
	    		table.deleteRow(1);
	    	}
    	}
    };
    
    var updateTable = function updateTable(){
    	/* inserisce in testa tutti i servizi 
    	 * presenti in this.serviceList
    	 */
    	var table = document.getElementById("servicesTable");
    	for(var i in this.serviceList){
	        var row = table.insertRow(1);
	        //row.addEventListener("click", handlerClickRow.bind(this, row), false);
	        var cell_id = row.insertCell(0);
	        var cell_type = row.insertCell(1);
	        var cell_desc = row.insertCell(2);
	        var tmp_service = this.serviceList[i];
	        cell_id.innerHTML = tmp_service.id;
	        cell_type.innerHTML = tmp_service.typeOfService;
	        cell_desc.innerHTML = tmp_service.description;
	        
	        row.addEventListener("click", handlerClickRow.bind(this, row), false);
    	}
    };
	
	/*
	 * Handler
	 */
	
	var handlerReceiveEntity = function handlerReceiveEntity(data) {
		
		/*
		var linea = "----------------------------------------" + "\n";
 		var ok = "OnNotify: OK\n";
 		var info = JSON.stringify(data)+"\n";
 		var testo = linea + ok + info + linea;
 		var response = document.createTextNode(testo);
 		this.contenitore.appendChild(response);
		*/
        var serviceDataList = data.elements;
        for (var serviceId in serviceDataList) {
            var service = serviceDataList[serviceId];
            
            /*
             * controllo se il servizio è nella lista dei servizi conosciuti
             * in caso affermativo devo aggiornare i dati nella lista
             * altrimenti devo inserire un nuovo servizio nella lista
             */
            if(serviceId in this.serviceList){//vecchio servizio aggiornato
            	delete this.serviceList[serviceId];
            	var updated_id = service.id;
            	var updated_description = service.description;
            	var updated_type = service.typeOfService;
            	var updated_service = {};
            	updated_service.id = updated_id;
            	updated_service.description = updated_description;
            	updated_service.typeOfService = updated_type;
            	this.serviceList[serviceId] = updated_service;

            	printDebug.call(this, 'onNotify', service);
            	
            }
            else{//nuovo servizio
            	var new_id = service.id;
            	var new_description = service.description;
            	var new_type = service.typeOfService;
            	var new_service = {};
            	new_service.id = new_id;
            	new_service.description = new_description;
            	new_service.typeOfService = new_type;
            	this.serviceList[serviceId] = new_service;

            	printDebug.call(this, 'onNotify', new_service);
            	
            }
            
        }
        /*Quando ho finito di aggiornare la serviceList
         * cancello tutte le righe della tabella
         * e scrivo le nuove righe con i valori aggiornati
         * in serviceList
         */
        deleteTable.call(this);
        updateTable.call(this);
    };

	window.Esempio = Esempio;

})();

var esempio = new Esempio();

window.addEventListener("DOMContentLoaded", esempio.init.bind(esempio), false);